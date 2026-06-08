const { conectar } = require("../db/neon");
const jwt = require("jsonwebtoken");

// ─────────────────────────────────────────────
// Helper — extrai id do token JWT
// O authController gera o token com { id, email }
// então usamos decoded.id
// ─────────────────────────────────────────────

function pegarIdUsuario(req) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer "))
    return null;

  const token = auth.split(" ")[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return decoded.id ?? null; // ← 'id', igual ao jwt.sign do authController
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────
// GET /api/usuarios-mercados/meus
// Lista apenas os mercados do usuário logado
// ─────────────────────────────────────────────

const meusMercados = async (req, res) => {
  const id_usuario = pegarIdUsuario(req);
  if (!id_usuario)
    return res.status(401).json({ erro: "Não autenticado" });

  try {
    const sql = await conectar();

    const mercados = await sql`
      SELECT m.*, um.papel
      FROM mercados m
      INNER JOIN usuarios_mercados um ON um.id_mercado = m.id_mercado
      WHERE um.id_usuario = ${id_usuario}
      ORDER BY m.data_cadastro DESC
    `;

    res.status(200).json({ mercados });
  } catch (err) {
    console.error("ERRO meusMercados:", err);
    res.status(500).json({ erro: err.message });
  }
};

// ─────────────────────────────────────────────
// GET /api/usuarios-mercados/:id_mercado/membros
// Lista todos os usuários vinculados a um mercado
// ─────────────────────────────────────────────

const listarMembros = async (req, res) => {
  const id_usuario = pegarIdUsuario(req);
  if (!id_usuario)
    return res.status(401).json({ erro: "Não autenticado" });

  const { id_mercado } = req.params;

  try {
    const sql = await conectar();

    // Verifica se o solicitante pertence ao mercado
    const [permissao] = await sql`
      SELECT papel FROM usuarios_mercados
      WHERE id_usuario = ${id_usuario}
        AND id_mercado = ${Number(id_mercado)}
    `;

    if (!permissao)
      return res.status(403).json({ erro: "Você não pertence a este mercado" });

    const membros = await sql`
      SELECT u.id_usuario, u.nome, u.email, um.papel
      FROM usuarios u
      INNER JOIN usuarios_mercados um ON um.id_usuario = u.id_usuario
      WHERE um.id_mercado = ${Number(id_mercado)}
      ORDER BY um.papel, u.nome
    `;

    res.status(200).json({ membros });
  } catch (err) {
    console.error("ERRO listarMembros:", err);
    res.status(500).json({ erro: err.message });
  }
};

// ─────────────────────────────────────────────
// POST /api/usuarios-mercados/:id_mercado/vincular
// Vincula um usuário a um mercado (requer dono/admin)
// Body: { id_usuario, papel }
// ─────────────────────────────────────────────

const vincularUsuario = async (req, res) => {
  const id_solicitante = pegarIdUsuario(req);
  if (!id_solicitante)
    return res.status(401).json({ erro: "Não autenticado" });

  const { id_mercado } = req.params;
  const { id_usuario, papel = "funcionario" } = req.body;

  if (!id_usuario)
    return res.status(400).json({ erro: "id_usuario é obrigatório" });

  const papeisPermitidos = ["dono", "admin", "funcionario"];
  if (!papeisPermitidos.includes(papel))
    return res.status(400).json({ erro: `Papel inválido. Use: ${papeisPermitidos.join(", ")}` });

  try {
    const sql = await conectar();

    const [permissao] = await sql`
      SELECT papel FROM usuarios_mercados
      WHERE id_usuario = ${id_solicitante}
        AND id_mercado = ${Number(id_mercado)}
    `;

    if (!permissao || !["dono", "admin"].includes(permissao.papel))
      return res.status(403).json({ erro: "Sem permissão para vincular usuários neste mercado" });

    const [jaVinculado] = await sql`
      SELECT id FROM usuarios_mercados
      WHERE id_usuario = ${Number(id_usuario)}
        AND id_mercado = ${Number(id_mercado)}
    `;

    if (jaVinculado)
      return res.status(409).json({ erro: "Usuário já vinculado a este mercado" });

    const [vinculo] = await sql`
      INSERT INTO usuarios_mercados (id_usuario, id_mercado, papel)
      VALUES (${Number(id_usuario)}, ${Number(id_mercado)}, ${papel})
      RETURNING *
    `;

    res.status(201).json({ mensagem: "Usuário vinculado com sucesso!", vinculo });
  } catch (err) {
    console.error("ERRO vincularUsuario:", err);
    res.status(500).json({ erro: err.message });
  }
};

// ─────────────────────────────────────────────
// DELETE /api/usuarios-mercados/:id_mercado/desvincular/:id_usuario
// Remove vínculo de um usuário com um mercado
// ─────────────────────────────────────────────

const desvincularUsuario = async (req, res) => {
  const id_solicitante = pegarIdUsuario(req);
  if (!id_solicitante)
    return res.status(401).json({ erro: "Não autenticado" });

  const { id_mercado, id_usuario } = req.params;

  try {
    const sql = await conectar();

    // Qualquer um pode se desvincular; só dono/admin pode desvincular outros
    if (Number(id_usuario) !== id_solicitante) {
      const [permissao] = await sql`
        SELECT papel FROM usuarios_mercados
        WHERE id_usuario = ${id_solicitante}
          AND id_mercado = ${Number(id_mercado)}
      `;

      if (!permissao || !["dono", "admin"].includes(permissao.papel))
        return res.status(403).json({ erro: "Sem permissão para desvincular este usuário" });
    }

    const [existente] = await sql`
      SELECT id FROM usuarios_mercados
      WHERE id_usuario = ${Number(id_usuario)}
        AND id_mercado = ${Number(id_mercado)}
    `;

    if (!existente)
      return res.status(404).json({ erro: "Vínculo não encontrado" });

    await sql`
      DELETE FROM usuarios_mercados
      WHERE id_usuario = ${Number(id_usuario)}
        AND id_mercado = ${Number(id_mercado)}
    `;

    res.status(200).json({ mensagem: "Usuário desvinculado com sucesso" });
  } catch (err) {
    console.error("ERRO desvincularUsuario:", err);
    res.status(500).json({ erro: err.message });
  }
};

module.exports = {
  meusMercados,
  vincularUsuario,
  desvincularUsuario,
  listarMembros,
};