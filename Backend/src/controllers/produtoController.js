const { conectar } = require('../db/neon')
const jwt = require('jsonwebtoken')

// ── Mesmo helper do marketController ─────────────────────────────────────────
function pegarIdUsuario(req) {
  const auth = req.headers.authorization
  if (!auth || !auth.startsWith('Bearer ')) return null
  const token = auth.split(' ')[1]
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    return decoded.id ?? null
  } catch {
    return null
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
      SELECT p.*
      FROM produtos p
      JOIN categorias c ON c.id_categoria = p.id_categoria
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
  const id_usuario = pegarIdUsuario(req)
  if (!id_usuario)
    return res.status(401).json({ erro: 'Não autenticado.' })

  const { mercadoId, categoriaId } = req.params
  const { nome, descricao, imagem } = req.body

  if (!nome?.trim())
    return res.status(400).json({ erro: 'O nome do produto é obrigatório.' })

  try {
    const sql = await conectar()

    // Verifica se o usuário tem acesso ao mercado
    const [permissao] = await sql`
      SELECT papel FROM usuarios_mercados
      WHERE id_usuario = ${id_usuario}
        AND id_mercado = ${Number(mercadoId)}
    `
    if (!permissao)
      return res.status(403).json({ erro: 'Você não tem acesso a este mercado.' })

    // Verifica se a categoria pertence ao mercado
    const [categoria] = await sql`
      SELECT id_categoria FROM categorias
      WHERE id_categoria = ${Number(categoriaId)}
        AND id_mercado   = ${Number(mercadoId)}
    `
    if (!categoria)
      return res.status(404).json({ erro: 'Categoria não encontrada neste mercado.' })

    const [novoProduto] = await sql`
      INSERT INTO produtos (nome, descricao, imagem, id_categoria)
      VALUES (
        ${nome.trim()},
        ${descricao?.trim() ?? null},
        ${imagem ?? null},
        ${Number(categoriaId)}
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
  const id_usuario = pegarIdUsuario(req)
  if (!id_usuario)
    return res.status(401).json({ erro: 'Não autenticado.' })

  const { mercadoId, categoriaId, produtoId } = req.params
  const { nome, descricao, imagem } = req.body

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

    const [produtoAtualizado] = await sql`
      UPDATE produtos
      SET nome      = ${nome.trim()},
          descricao = ${descricao?.trim() ?? null},
          imagem    = ${imagem ?? null}
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
  const id_usuario = pegarIdUsuario(req)
  if (!id_usuario)
    return res.status(401).json({ erro: 'Não autenticado.' })

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