const { conectar } = require('../db/neon')
const { limitesDoPlano } = require('../utils/planos')

function parsePreco(valor) {
  if (typeof valor === 'number') return valor;
  if (typeof valor !== 'string') return 0;
  const num = Number(valor.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(num) ? num : 0;
}

// Preço/estoque nunca podem ser negativos (aceita 0 = gratuito/promoção).
function precoValido(valor) {
  const num = parsePreco(valor);
  if (!Number.isFinite(num) || num < 0 || num > 99999999) return null;
  return num;
}

function estoqueValido(valor) {
  const num = Number(valor);
  if (!Number.isFinite(num) || num < 0) return null;
  return Math.min(Math.floor(num), 9999999);
}

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

// GET /api/mercados/:mercadoId/categorias/:categoriaId/produtos

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

// POST /api/mercados/:mercadoId/categorias/:categoriaId/produtos

const criarProduto = async (req, res) => {
  const id_usuario = req.usuarioId

  const { mercadoId, categoriaId } = req.params
  const { nome, descricao, preco, estoque, imagens, custo } = req.body

  if (!nome?.trim())
    return res.status(400).json({ erro: 'O nome do produto é obrigatório.' })

  const precoNum = precoValido(preco)
  if (precoNum === null)
    return res.status(400).json({ erro: 'Preço inválido (deve ser um valor igual ou maior que zero).' })

  const estoqueNum = estoqueValido(estoque)
  if (estoqueNum === null)
    return res.status(400).json({ erro: 'Estoque inválido (deve ser um número igual ou maior que zero).' })

  try {
    const sql = await conectar()

    const [permissao] = await sql`
      SELECT papel FROM usuarios_mercados
      WHERE id_usuario = ${id_usuario}
        AND id_mercado = ${Number(mercadoId)}
    `
    if (!permissao || !['dono', 'admin'].includes(permissao.papel))
      return res.status(403).json({ erro: 'Apenas o dono ou admin pode gerenciar produtos.' })

    const [categoria] = await sql`
      SELECT id_categoria FROM categorias
      WHERE id_categoria = ${Number(categoriaId)}
        AND id_mercado   = ${Number(mercadoId)}
    `
    if (!categoria)
      return res.status(404).json({ erro: 'Categoria não encontrada neste mercado.' })

    const imagensUrls = Array.isArray(imagens) ? imagens : []
    const imagem = imagensUrls[0] || null

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
      INSERT INTO produtos (nome, descricao, imagem, preco, imagens, id_categoria, estoque, custo)
      VALUES (
        ${nome.trim()},
        ${descricao?.trim() ?? null},
        ${imagem},
        ${precoNum},
        ${imagensUrls},
        ${Number(categoriaId)},
        ${estoqueNum},
        ${Math.max(0, Math.min(99999999, parsePreco(custo)))}
      )
      RETURNING *
    `

    res.status(201).json(novoProduto)
  } catch (err) {
    console.error('ERRO criarProduto:', err)
    res.status(500).json({ erro: err.message })
  }
}

// PUT /api/mercados/:mercadoId/categorias/:categoriaId/produtos/:produtoId

const atualizarProduto = async (req, res) => {
  const id_usuario = req.usuarioId

  const { mercadoId, categoriaId, produtoId } = req.params
  const { nome, descricao, preco, estoque, imagens, custo } = req.body

  if (!nome?.trim())
    return res.status(400).json({ erro: 'O nome do produto é obrigatório.' })

  const precoNum = precoValido(preco)
  if (precoNum === null)
    return res.status(400).json({ erro: 'Preço inválido (deve ser um valor igual ou maior que zero).' })

  const estoqueNum = estoqueValido(estoque)
  if (estoqueNum === null)
    return res.status(400).json({ erro: 'Estoque inválido (deve ser um número igual ou maior que zero).' })

  try {
    const sql = await conectar()

    const [permissao] = await sql`
      SELECT papel FROM usuarios_mercados
      WHERE id_usuario = ${id_usuario}
        AND id_mercado = ${Number(mercadoId)}
    `
    if (!permissao || !['dono', 'admin'].includes(permissao.papel))
      return res.status(403).json({ erro: 'Apenas o dono ou admin pode gerenciar produtos.' })

    const [categoria] = await sql`
      SELECT id_categoria FROM categorias
      WHERE id_categoria = ${Number(categoriaId)}
        AND id_mercado   = ${Number(mercadoId)}
    `
    if (!categoria)
      return res.status(404).json({ erro: 'Categoria não encontrada neste mercado.' })

    const imagensUrls = Array.isArray(imagens) ? imagens : []
    const imagem = imagensUrls.length > 0 ? imagensUrls[0] : undefined

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

    const custoNovo = custo === undefined || custo === null
      ? null
      : Math.max(0, Math.min(99999999, parsePreco(custo)))

    const [produtoAtualizado] = await sql`
      UPDATE produtos
      SET nome      = ${nome.trim()},
          descricao = ${descricao?.trim() ?? null},
          imagem    = COALESCE(${imagem ?? null}, imagem),
          preco     = ${precoNum},
          custo     = COALESCE(${custoNovo}, custo),
          imagens   = CASE WHEN ${imagensUrls.length} > 0 THEN ${imagensUrls} ELSE imagens END,
          estoque   = ${estoqueNum}
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

// DELETE /api/mercados/:mercadoId/categorias/:categoriaId/produtos/:produtoId

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
    if (!permissao || !['dono', 'admin'].includes(permissao.papel))
      return res.status(403).json({ erro: 'Apenas o dono ou admin pode gerenciar produtos.' })

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