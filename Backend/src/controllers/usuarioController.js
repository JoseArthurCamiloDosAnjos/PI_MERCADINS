const { conectar } = require("../db/neon");

const listarFavoritos = async (req, res) => {
  const id_usuario = req.usuarioId;

  try {
    const sql = await conectar();

    const favoritos = await montarFavoritos(sql, id_usuario);

    res.status(200).json({ favoritos });
  } catch (err) {
    console.error("ERRO listarFavoritos:", err);
    res.status(500).json({ erro: err.message });
  }
};

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

const listarHistorico = async (req, res) => {
  const id_usuario = req.usuarioId;

  try {
    const sql = await conectar();

    const historico = await sql`
      SELECT h.id, h.id_mercado, m.nome AS mercado, m.slug, h.produtos, h.valor_total,
             h.data_compra, h.status, h.observacao, h.itens_json, h.forma_pagamento
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

async function montarFavoritos(sql, id_usuario) {
  return await sql`
    SELECT f.id, f.id_mercado, f.data_cadastro,
           m.nome, m.slug, m.foto_perfil, m.cidade, m.estado, m.status,
           COALESCE(
             (SELECT ROUND(AVG(nota), 1) FROM avaliacoes a WHERE a.id_mercado = m.id_mercado),
             0
           )::float AS avaliacao,
           COALESCE(
             (SELECT COUNT(*) FROM avaliacoes a WHERE a.id_mercado = m.id_mercado),
             0
           )::int AS num_avaliacoes
    FROM favoritos f
    INNER JOIN mercados m ON m.id_mercado = f.id_mercado
    WHERE f.id_usuario = ${id_usuario}
    ORDER BY f.data_cadastro DESC
  `;
}

const favoritarMercado = async (req, res) => {
  const id_usuario = req.usuarioId;
  const id_mercado = Number(req.params.id);
  const favoritado = req.method === 'POST';

  if (!id_usuario)
    return res.status(401).json({ erro: "Faça login para favoritar mercados" });

  try {
    const sql = await conectar();

    const [mercado] = await sql`
      SELECT id_mercado FROM mercados WHERE id_mercado = ${id_mercado}
    `;
    if (!mercado)
      return res.status(404).json({ erro: "Mercado não encontrado" });

    if (favoritado) {
      await sql`
        INSERT INTO favoritos (id_usuario, id_mercado)
        VALUES (${id_usuario}, ${id_mercado})
        ON CONFLICT (id_usuario, id_mercado) DO NOTHING
      `;
    } else {
      await sql`
        DELETE FROM favoritos
        WHERE id_usuario = ${id_usuario} AND id_mercado = ${id_mercado}
      `;
    }

    const favoritos = await montarFavoritos(sql, id_usuario);

    res.status(200).json({ favoritado, favoritos });
  } catch (err) {
    console.error("ERRO favoritarMercado:", err);
    res.status(500).json({ erro: err.message });
  }
};

module.exports = {
  listarFavoritos,
  listarAvaliacoes,
  listarHistorico,
  favoritarMercado,
};
