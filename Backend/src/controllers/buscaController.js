const { conectar } = require('../db/neon');

// ─────────────────────────────────────────────
// GET /api/busca/produtos?q=termo
// Busca produtos em TODOS os mercados ativos.
// Busca sem acento e sem diferenciar maiúsculas
// ("agua" acha "Água mineral", "PÃO" acha "pão").
// ─────────────────────────────────────────────
const buscarProdutos = async (req, res) => {
  const q = String(req.query.q ?? '').trim();

  if (q.length < 2) {
    return res.status(200).json({ total: 0, produtos: [] });
  }

  try {
    const sql = await conectar();

    const produtos = await sql`
      SELECT
        p.id_produto, p.nome, p.preco, p.imagem, p.imagens, p.estoque,
        c.id_categoria, c.nome AS categoria,
        m.id_mercado, m.nome AS mercado, m.slug, m.cidade, m.estado
      FROM produtos p
      JOIN categorias c ON c.id_categoria = p.id_categoria
      JOIN mercados  m ON m.id_mercado  = c.id_mercado
      WHERE m.status = 'ativo'
        AND (
          sem_acento(p.nome)      ILIKE '%' || sem_acento(${q}) || '%'
          OR sem_acento(p.descricao) ILIKE '%' || sem_acento(${q}) || '%'
        )
      ORDER BY
        (sem_acento(p.nome) ILIKE sem_acento(${q}) || '%' ) DESC,
        (p.estoque > 0) DESC,
        p.nome ASC
      LIMIT 20
    `;

    res.status(200).json({
      total: produtos.length,
      produtos: produtos.map(p => ({
        id_produto: p.id_produto,
        nome: p.nome,
        preco: Number(p.preco ?? 0),
        imagem: p.imagem ?? (Array.isArray(p.imagens) ? p.imagens[0] : '') ?? '',
        estoque: Number(p.estoque) || 0,
        categoria: p.categoria,
        id_categoria: p.id_categoria,
        id_mercado: p.id_mercado,
        mercado: p.mercado,
        slug: p.slug,
        cidade: p.cidade,
        estado: p.estado,
      })),
    });
  } catch (err) {
    console.error('ERRO buscarProdutos:', err);
    res.status(500).json({ erro: 'Não foi possível buscar produtos.' });
  }
};

module.exports = { buscarProdutos };
