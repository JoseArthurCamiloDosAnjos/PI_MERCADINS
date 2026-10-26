// ─────────────────────────────────────────────────────────────────────────────
//  Endereços de entrega do cliente (carteira de endereços)
//
//  O cliente cadastra no perfil e escolhe no carrinho qual endereço recebe
//  a entrega. Tudo ligado ao usuário logado (req.usuarioId).
// ─────────────────────────────────────────────────────────────────────────────

const { conectar } = require("../db/neon");

// Teto de segurança: evita que alguém encha o banco com endereços
const LIMITE_POR_USUARIO = 10;

const LIMITES = {
  cep: 9,
  rua: 120,
  numero: 10,
  bairro: 80,
  cidade: 80,
  complemento: 120,
};

const CAMPOS_OBRIGATORIOS = [
  ["cep", "CEP"],
  ["rua", "rua"],
  ["numero", "número"],
  ["bairro", "bairro"],
  ["cidade", "cidade"],
];

/** Corta espaços sobrando e derruba acentos de emoji que venham no texto */
function limpar(valor) {
  return String(valor ?? "").trim().replace(/\s+/g, " ");
}

function montarEndereco(corpo) {
  const dados = {};
  for (const campo of Object.keys(LIMITES)) {
    dados[campo] = limpar(corpo?.[campo]).slice(0, LIMITES[campo]);
  }
  return dados;
}

// GET /api/enderecos
const listarEnderecos = async (req, res) => {
  try {
    const sql = await conectar();

    const enderecos = await sql`
      SELECT id_endereco AS id, cep, rua, numero, bairro, cidade, complemento
      FROM enderecos_usuario
      WHERE id_usuario = ${req.usuarioId}
      ORDER BY criado_em ASC, id_endereco ASC
    `;

    res.status(200).json({ enderecos });
  } catch (err) {
    console.error("ERRO listarEnderecos:", err);
    res.status(500).json({ erro: "Não foi possível carregar seus endereços." });
  }
};

// POST /api/enderecos
const criarEndereco = async (req, res) => {
  try {
    const dados = montarEndereco(req.body);

    const faltando = CAMPOS_OBRIGATORIOS.filter(([campo]) => !dados[campo]).map(
      ([, nome]) => nome
    );
    if (faltando.length > 0) {
      return res.status(400).json({ erro: `Preencha: ${faltando.join(", ")}.` });
    }

    // CEP sempre no formato 12345-678 (a tela já máscara, aqui garantimos)
    if (!/^\d{5}-\d{3}$/.test(dados.cep)) {
      return res.status(400).json({ erro: "CEP inválido. Use o formato 00000-000." });
    }

    const sql = await conectar();

    const total = await sql`
      SELECT COUNT(*) AS total FROM enderecos_usuario WHERE id_usuario = ${req.usuarioId}
    `;
    if (Number(total[0].total) >= LIMITE_POR_USUARIO) {
      return res.status(400).json({
        erro: `Você já tem ${LIMITE_POR_USUARIO} endereços salvos. Remova algum para cadastrar outro.`,
      });
    }

    const criados = await sql`
      INSERT INTO enderecos_usuario (id_usuario, cep, rua, numero, bairro, cidade, complemento)
      VALUES (${req.usuarioId}, ${dados.cep}, ${dados.rua}, ${dados.numero},
              ${dados.bairro}, ${dados.cidade}, ${dados.complemento})
      RETURNING id_endereco AS id, cep, rua, numero, bairro, cidade, complemento
    `;

    res.status(201).json({ endereco: criados[0] });
  } catch (err) {
    console.error("ERRO criarEndereco:", err);
    res.status(500).json({ erro: "Não foi possível salvar o endereço." });
  }
};

// DELETE /api/enderecos/:id
const removerEndereco = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ erro: "Endereço inválido." });
    }

    const sql = await conectar();

    // O WHERE com id_usuario garante que ninguém apague o endereço de outro
    const removidos = await sql`
      DELETE FROM enderecos_usuario
      WHERE id_endereco = ${id} AND id_usuario = ${req.usuarioId}
      RETURNING id_endereco
    `;

    if (removidos.length === 0) {
      return res.status(404).json({ erro: "Endereço não encontrado." });
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error("ERRO removerEndereco:", err);
    res.status(500).json({ erro: "Não foi possível remover o endereço." });
  }
};

module.exports = { listarEnderecos, criarEndereco, removerEndereco };
