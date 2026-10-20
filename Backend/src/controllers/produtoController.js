const { conectar } = require('../db/neon')
const { limitesDoPlano } = require('../utils/planos')

function parsePreco(valor) {
  if (typeof valor === 'number') return valor;
  if (typeof valor !== 'string') return 0;
  const num = Number(valor.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(num) ? num : 0;
}

// Uso atual do mercado: quantos produtos cadastrados e quantas fotos usadas
async function usoDoMercado(sql, mercadoId) {
  const produtos = await sql`
    SELECT COALESCE(array_length(p.imagens, 1), 0) AS fotos
    FROM produtos p
    JOIN categorias c ON c.id_categoria = p.id_categoria
    WHERE c.id_mercado = ${Number(mercadoId)}
  `
  return {
    produtos: produtos.length,
    fotos: produtos.reduce((soma, p) => soma + Number(p.fotos || 0), 0),
  }
}

// ─────────────────────────────────────────────
// GET /api/mercados/:mercadoId/categorias/:categoriaId/produtos
// Público — carrega produtos de uma categoria
// ─────────────────────────────────────────────

const listarProdutos = async (req, res) => {
  const { mercadoId, categoriaId } = req.params

  try {
    const sql = await conectar()

    const produtos = await sql`
      SELECT p.*,
             COALESCE(ap.media, 0)::float AS avaliacao,
             COALESCE(ap.total, 0)::int   AS "numAvaliacoes"
      FROM produtos p
      JOIN categorias c ON c.id_categoria = p.id_categoria
      LEFT JOIN (
        SELECT id_produto,
               ROUND(AVG(nota), 1) AS media,
               COUNT(*)            AS total
        FROM avaliacoes_produtos
        GROUP BY id_produto
      ) ap ON ap.id_produto = p.id_produto
      WHERE p.id_categoria = ${Number(categoriaId)}
        AND c.id_mercado   = ${Number(mercadoId)}
      ORDER BY p.id_produto
    `

    res.status(200).json(produtos)
  } catch (err) {
    console.error('ERRO listarProdutos:', err)
    res.status(500).json({ erro: err.message })
  }
}

// ─────────────────────────────────────────────
// POST /api/mercados/:mercadoId/categorias/:categoriaId/produtos
// Requer autenticação — só dono/admin do mercado
// ─────────────────────────────────────────────

const criarProduto = async (req, res) => {
  const id_usuario = req.usuarioId

  const { mercadoId, categoriaId } = req.params
  const { nome, descricao, preco, estoque, imagens } = req.body

  if (!nome?.trim())
    return res.status(400).json({ erro: 'O nome do produto é obrigatório.' })

  try {
    const sql = await conectar()

    const [permissao] = await sql`
      SELECT papel FROM usuarios_mercados
      WHERE id_usuario = ${id_usuario}
        AND id_mercado = ${Number(mercadoId)}
    `
    if (!permissao)
      return res.status(403).json({ erro: 'Você não tem acesso a este mercado.' })

    const [categoria] = await sql`
      SELECT id_categoria FROM categorias
      WHERE id_categoria = ${Number(categoriaId)}
        AND id_mercado   = ${Number(mercadoId)}
    `
    if (!categoria)
      return res.status(404).json({ erro: 'Categoria não encontrada neste mercado.' })

    const imagensUrls = Array.isArray(imagens) ? imagens : []
    const imagem = imagensUrls[0] || null

    // Limites do plano: produtos e fotos
    const [mercado] = await sql`
      SELECT plano FROM mercados WHERE id_mercado = ${Number(mercadoId)}
    `
    const limites = limitesDoPlano(mercado?.plano)
    const uso = await usoDoMercado(sql, mercadoId)

    if (uso.produtos >= limites.produtos) {
      return res.status(403).json({
        erro: `Seu plano ${limites.nome} permite até ${limites.produtos} produtos. Faça upgrade para cadastrar mais.`,
      })
    }
    if (uso.fotos + imagensUrls.length > limites.fotos) {
      return res.status(403).json({
        erro: `Seu plano ${limites.nome} permite até ${limites.fotos} fotos (${uso.fotos} já usadas). Remova fotos ou faça upgrade.`,
      })
    }

    const [novoProduto] = await sql`
      INSERT INTO produtos (nome, descricao, imagem, preco, imagens, id_categoria, estoque)
      VALUES (
        ${nome.trim()},
        ${descricao?.trim() ?? null},
        ${imagem},
        ${parsePreco(preco)},
        ${imagensUrls},
        ${Number(categoriaId)},
        ${Number(estoque) || 0}
      )
      RETURNING *
    `

    res.status(201).json(novoProduto)
  } catch (err) {
    console.error('ERRO criarProduto:', err)
    res.status(500).json({ erro: err.message })
  }
}

// ─────────────────────────────────────────────
// PUT /api/mercados/:mercadoId/categorias/:categoriaId/produtos/:produtoId
// ─────────────────────────────────────────────

const atualizarProduto = async (req, res) => {
  const id_usuario = req.usuarioId

  const { mercadoId, categoriaId, produtoId } = req.params
  const { nome, descricao, preco, estoque, imagens } = req.body

  if (!nome?.trim())
    return res.status(400).json({ erro: 'O nome do produto é obrigatório.' })

  try {
    const sql = await conectar()

    const [permissao] = await sql`
      SELECT papel FROM usuarios_mercados
      WHERE id_usuario = ${id_usuario}
        AND id_mercado = ${Number(mercadoId)}
    `
    if (!permissao)
      return res.status(403).json({ erro: 'Você não tem acesso a este mercado.' })

    const [categoria] = await sql`
      SELECT id_categoria FROM categorias
      WHERE id_categoria = ${Number(categoriaId)}
        AND id_mercado   = ${Number(mercadoId)}
    `
    if (!categoria)
      return res.status(404).json({ erro: 'Categoria não encontrada neste mercado.' })

    const imagensUrls = Array.isArray(imagens) ? imagens : []
    const imagem = imagensUrls.length > 0 ? imagensUrls[0] : undefined

    // Limites do plano na edição: só valida fotos se o cliente enviou novas
    if (imagensUrls.length > 0) {
      const [mercado] = await sql`
        SELECT plano FROM mercados WHERE id_mercado = ${Number(mercadoId)}
      `
      const limites = limitesDoPlano(mercado?.plano)
      const uso = await usoDoMercado(sql, mercadoId)

      const [produtoAtual] = await sql`
        SELECT COALESCE(array_length(imagens, 1), 0) AS fotos
        FROM produtos
        WHERE id_produto = ${Number(produtoId)}
      `
      const fotosAtuais = Number(produtoAtual?.fotos || 0)

      if (uso.fotos - fotosAtuais + imagensUrls.length > limites.fotos) {
        return res.status(403).json({
          erro: `Seu plano ${limites.nome} permite até ${limites.fotos} fotos (${uso.fotos} já usadas). Remova fotos ou faça upgrade.`,
        })
      }
    }

    const [produtoAtualizado] = await sql`
      UPDATE produtos
      SET nome      = ${nome.trim()},
          descricao = ${descricao?.trim() ?? null},
          imagem    = COALESCE(${imagem ?? null}, imagem),
          preco     = ${parsePreco(preco)},
          imagens   = CASE WHEN ${imagensUrls.length} > 0 THEN ${imagensUrls} ELSE imagens END,
          estoque   = ${Number(estoque) || 0}
      WHERE id_produto   = ${Number(produtoId)}
        AND id_categoria = ${Number(categoriaId)}
      RETURNING *
    `

    if (!produtoAtualizado)
      return res.status(404).json({ erro: 'Produto não encontrado.' })

    res.status(200).json(produtoAtualizado)
  } catch (err) {
    console.error('ERRO atualizarProduto:', err)
    res.status(500).json({ erro: err.message })
  }
}

// ─────────────────────────────────────────────
// DELETE /api/mercados/:mercadoId/categorias/:categoriaId/produtos/:produtoId
// ─────────────────────────────────────────────

const deletarProduto = async (req, res) => {
  const id_usuario = req.usuarioId

  const { mercadoId, categoriaId, produtoId } = req.params

  try {
    const sql = await conectar()

    const [permissao] = await sql`
      SELECT papel FROM usuarios_mercados
      WHERE id_usuario = ${id_usuario}
        AND id_mercado = ${Number(mercadoId)}
    `
    if (!permissao)
      return res.status(403).json({ erro: 'Você não tem acesso a este mercado.' })

    const [categoria] = await sql`
      SELECT id_categoria FROM categorias
      WHERE id_categoria = ${Number(categoriaId)}
        AND id_mercado   = ${Number(mercadoId)}
    `
    if (!categoria)
      return res.status(404).json({ erro: 'Categoria não encontrada neste mercado.' })

    const [deletado] = await sql`
      DELETE FROM produtos
      WHERE id_produto   = ${Number(produtoId)}
        AND id_categoria = ${Number(categoriaId)}
      RETURNING id_produto
    `

    if (!deletado)
      return res.status(404).json({ erro: 'Produto não encontrado.' })

    res.status(200).json({ mensagem: 'Produto removido com sucesso.' })
  } catch (err) {
    console.error('ERRO deletarProduto:', err)
    res.status(500).json({ erro: err.message })
  }
}

module.exports = { criarProduto, listarProdutos, atualizarProduto, deletarProduto }