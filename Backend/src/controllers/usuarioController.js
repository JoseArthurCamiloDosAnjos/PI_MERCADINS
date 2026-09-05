const { conectar } = require("../db/neon");

// GET /api/usuario/favoritos
const listarFavoritos = async (req, res) => {
  const id_usuario = req.usuarioId;

  try {
    const sql = await conectar();

    const favoritos = await sql`
      SELECT f.id, f.id_mercado, m.nome, f.data_cadastro
      FROM favoritos f
      INNER JOIN mercados m ON m.id_mercado = f.id_mercado
      WHERE f.id_usuario = ${id_usuario}
      ORDER BY f.data_cadastro DESC
    `;

    res.status(200).json({ favoritos });
  } catch (err) {
    console.error("ERRO listarFavoritos:", err);
    res.status(500).json({ erro: err.message });
  }
};

// GET /api/usuario/avaliacoes
const listarAvaliacoes = async (req, res) => {
  const id_usuario = req.usuarioId;

  try {
    const sql = await conectar();

    const avaliacoes = await sql`
      SELECT a.id, a.id_mercado, m.nome AS loja, a.nota, a.texto, a.data_cadastro
      FROM avaliacoes a
      INNER JOIN mercados m ON m.id_mercado = a.id_mercado
      WHERE a.id_usuario = ${id_usuario}
      ORDER BY a.data_cadastro DESC
    `;

    res.status(200).json({ avaliacoes });
  } catch (err) {
    console.error("ERRO listarAvaliacoes:", err);
    res.status(500).json({ erro: err.message });
  }
};

// GET /api/usuario/historico
const listarHistorico = async (req, res) => {
  const id_usuario = req.usuarioId;

  try {
    const sql = await conectar();

    const historico = await sql`
      SELECT h.id, h.id_mercado, m.nome AS mercado, h.produtos, h.valor_total, h.data_compra, h.status
      FROM historico_compras h
      INNER JOIN mercados m ON m.id_mercado = h.id_mercado
      WHERE h.id_usuario = ${id_usuario}
      ORDER BY h.data_compra DESC
    `;

    res.status(200).json({ historico });
  } catch (err) {
    console.error("ERRO listarHistorico:", err);
    res.status(500).json({ erro: err.message });
  }
};

module.exports = {
  listarFavoritos,
  listarAvaliacoes,
  listarHistorico,
};
