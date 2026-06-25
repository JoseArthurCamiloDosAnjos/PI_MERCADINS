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
// Helpers de validação
// ─────────────────────────────────────────────

function limparMascara(valor) {
  return valor.replace(/\D/g, "");
}

function validarCNPJ(cnpj) {
  const nums = limparMascara(cnpj);
  if (nums.length !== 14) return false;
  if (/^(\d)\1+$/.test(nums)) return false;

  const calcDigito = (base, pesos) => {
    const soma = base
      .split("")
      .reduce((acc, d, i) => acc + parseInt(d) * pesos[i], 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };

  const pesos1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const pesos2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  const d1 = calcDigito(nums.slice(0, 12), pesos1);
  const d2 = calcDigito(nums.slice(0, 13), pesos2);

  return parseInt(nums[12]) === d1 && parseInt(nums[13]) === d2;
}

function validarCEP(cep) {
  return /^\d{8}$/.test(limparMascara(cep));
}

function validarEmailSimples(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validarTelefone(telefone) {
  const nums = limparMascara(telefone);
  return nums.length === 10 || nums.length === 11;
}

// ─────────────────────────────────────────────
// POST /api/mercados — Criar novo mercado
// Requer autenticação — vincula ao usuário logado
// ─────────────────────────────────────────────

const criarMercado = async (req, res) => {
  // Verifica autenticação primeiro
  const id_usuario = pegarIdUsuario(req);
  if (!id_usuario)
    return res.status(401).json({ erro: "Não autenticado. Faça login para cadastrar um mercado." });

  const { nome, email, telefone, cnpj, cep, estado, cidade, bairro, rua } = req.body;

  if (!nome || !email || !telefone || !cnpj || !cep || !estado || !cidade || !bairro || !rua)
    return res.status(400).json({ erro: "Todos os campos são obrigatórios" });

  if (!validarEmailSimples(email))
    return res.status(400).json({ erro: "Email inválido" });

  if (!validarTelefone(telefone))
    return res.status(400).json({ erro: "Telefone inválido" });

  if (!validarCNPJ(cnpj))
    return res.status(400).json({ erro: "CNPJ inválido" });

  if (!validarCEP(cep))
    return res.status(400).json({ erro: "CEP inválido" });

  const cnpjLimpo     = limparMascara(cnpj);
  const cepLimpo      = limparMascara(cep);
  const telefoneLimpo = limparMascara(telefone);

  try {
    const sql = await conectar();

    // Verifica duplicidade de CNPJ ou email
    const existente = await sql`
      SELECT id_mercado FROM mercados
      WHERE cnpj = ${cnpjLimpo} OR email = ${email.trim().toLowerCase()}
    `;

    if (existente.length > 0)
      return res.status(409).json({ erro: "CNPJ ou email já cadastrado" });

    // Cria o mercado
    const [novoMercado] = await sql`
      INSERT INTO mercados (nome, email, telefone, cnpj, cep, estado, cidade, bairro, rua)
      VALUES (
        ${nome.trim()},
        ${email.trim().toLowerCase()},
        ${telefoneLimpo},
        ${cnpjLimpo},
        ${cepLimpo},
        ${estado.trim().toUpperCase()},
        ${cidade.trim()},
        ${bairro.trim()},
        ${rua.trim()}
      )
      RETURNING *
    `;

    // ✅ Vincula o mercado ao usuário logado com papel 'dono'
    await sql`
      INSERT INTO usuarios_mercados (id_usuario, id_mercado, papel)
      VALUES (${id_usuario}, ${novoMercado.id_mercado}, 'dono')
    `;

    res.status(201).json({
      mensagem: "Mercado criado com sucesso!",
      mercado: novoMercado,
    });
  } catch (err) {
    console.error("ERRO criarMercado:", err);
    res.status(500).json({ erro: err.message });
  }
};

// ─────────────────────────────────────────────
// GET /api/mercados — Listar todos os mercados
// Rota pública
// ─────────────────────────────────────────────

const listarMercados = async (req, res) => {
  try {
    const sql = await conectar();

    const mercados = await sql`
      SELECT * FROM mercados
      ORDER BY data_cadastro DESC
    `;

    res.status(200).json({ mercados });
  } catch (err) {
    console.error("ERRO listarMercados:", err);
    res.status(500).json({ erro: err.message });
  }
};

// ─────────────────────────────────────────────
// GET /api/mercados/:id — Buscar mercado por ID
// ─────────────────────────────────────────────

const buscarMercadoPorId = async (req, res) => {
  const { id } = req.params;

  try {
    const sql = await conectar();

    const [mercado] = await sql`
      SELECT * FROM mercados
      WHERE id_mercado = ${Number(id)}
    `;

    if (!mercado)
      return res.status(404).json({ erro: "Mercado não encontrado" });

    res.status(200).json({ mercado });
  } catch (err) {
    console.error("ERRO buscarMercadoPorId:", err);
    res.status(500).json({ erro: err.message });
  }
};

// ─────────────────────────────────────────────
// PUT /api/mercados/:id — Atualizar mercado
// Só dono ou admin do mercado pode atualizar
// ─────────────────────────────────────────────

const atualizarMercado = async (req, res) => {
  const id_usuario = pegarIdUsuario(req);
  if (!id_usuario)
    return res.status(401).json({ erro: "Não autenticado" });

  const { id } = req.params;
  const { nome, email, telefone, cnpj, cep, estado, cidade, bairro, rua } = req.body;

  if (email && !validarEmailSimples(email))
    return res.status(400).json({ erro: "Email inválido" });

  if (telefone && !validarTelefone(telefone))
    return res.status(400).json({ erro: "Telefone inválido" });

  if (cnpj && !validarCNPJ(cnpj))
    return res.status(400).json({ erro: "CNPJ inválido" });

  if (cep && !validarCEP(cep))
    return res.status(400).json({ erro: "CEP inválido" });

  try {
    const sql = await conectar();

    // Verifica se o usuário tem permissão neste mercado
    const [permissao] = await sql`
      SELECT papel FROM usuarios_mercados
      WHERE id_usuario = ${id_usuario}
        AND id_mercado = ${Number(id)}
    `;

    if (!permissao)
      return res.status(403).json({ erro: "Você não tem acesso a este mercado" });

    if (!["dono", "admin"].includes(permissao.papel))
      return res.status(403).json({ erro: "Apenas o dono ou admin pode editar o mercado" });

    const [existente] = await sql`
      SELECT id_mercado FROM mercados
      WHERE id_mercado = ${Number(id)}
    `;

    if (!existente)
      return res.status(404).json({ erro: "Mercado não encontrado" });

    const [mercadoAtualizado] = await sql`
      UPDATE mercados SET
        nome     = COALESCE(${nome?.trim()                       ?? null}, nome),
        email    = COALESCE(${email?.trim().toLowerCase()        ?? null}, email),
        telefone = COALESCE(${telefone ? limparMascara(telefone) : null}, telefone),
        cnpj     = COALESCE(${cnpj    ? limparMascara(cnpj)      : null}, cnpj),
        cep      = COALESCE(${cep     ? limparMascara(cep)       : null}, cep),
        estado   = COALESCE(${estado?.trim().toUpperCase()       ?? null}, estado),
        cidade   = COALESCE(${cidade?.trim()                     ?? null}, cidade),
        bairro   = COALESCE(${bairro?.trim()                     ?? null}, bairro),
        rua      = COALESCE(${rua?.trim()                        ?? null}, rua)
      WHERE id_mercado = ${Number(id)}
      RETURNING *
    `;

    res.status(200).json({
      mensagem: "Mercado atualizado com sucesso!",
      mercado: mercadoAtualizado,
    });
  } catch (err) {
    console.error("ERRO atualizarMercado:", err);
    res.status(500).json({ erro: err.message });
  }
};

// ─────────────────────────────────────────────
// DELETE /api/mercados/:id — Deletar mercado
// Só o dono pode deletar
// ─────────────────────────────────────────────

const deletarMercado = async (req, res) => {
  const id_usuario = pegarIdUsuario(req);
  if (!id_usuario)
    return res.status(401).json({ erro: "Não autenticado" });

  const { id } = req.params;

  try {
    const sql = await conectar();

    const [permissao] = await sql`
      SELECT papel FROM usuarios_mercados
      WHERE id_usuario = ${id_usuario}
        AND id_mercado = ${Number(id)}
    `;

    if (!permissao)
      return res.status(403).json({ erro: "Você não tem acesso a este mercado" });

    if (permissao.papel !== "dono")
      return res.status(403).json({ erro: "Apenas o dono pode deletar o mercado" });

    const [existente] = await sql`
      SELECT id_mercado FROM mercados
      WHERE id_mercado = ${Number(id)}
    `;

    if (!existente)
      return res.status(404).json({ erro: "Mercado não encontrado" });

    // Remove vínculos primeiro (FK), depois o mercado
    await sql`DELETE FROM usuarios_mercados WHERE id_mercado = ${Number(id)}`;
    await sql`DELETE FROM mercados WHERE id_mercado = ${Number(id)}`;

    res.status(200).json({ mensagem: "Mercado deletado com sucesso" });
  } catch (err) {
    console.error("ERRO deletarMercado:", err);
    res.status(500).json({ erro: err.message });
  }
};
// GET /api/meus-mercados — mercados do usuário logado
const meusMercados = async (req, res) => {
  const id_usuario = pegarIdUsuario(req);
  if (!id_usuario)
    return res.status(401).json({ erro: "Não autenticado" });

  try {
    const sql = await conectar();
    const mercados = await sql`
      SELECT m.* FROM mercados m
      INNER JOIN usuarios_mercados um ON um.id_mercado = m.id_mercado
      WHERE um.id_usuario = ${id_usuario}
      ORDER BY m.data_cadastro DESC
    `;
    res.status(200).json({ mercados });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
};


module.exports = {
  criarMercado,
  listarMercados,
  buscarMercadoPorId,
  atualizarMercado,
  deletarMercado,
  meusMercados
};