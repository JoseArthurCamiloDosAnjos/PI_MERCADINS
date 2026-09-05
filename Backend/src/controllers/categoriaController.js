const { conectar } = require('../db/neon')

const listarCategorias = async (req, res) => {
  const { mercadoId } = req.params

  try {
    const sql = await conectar()
    const categorias = await sql`
      SELECT id_categoria AS id, nome
      FROM categorias
      WHERE id_mercado = ${Number(mercadoId)}
      ORDER BY id_categoria
    `
    res.status(200).json(categorias)
  } catch (err) {
    console.error('ERRO listarCategorias:', err)
    res.status(500).json({ erro: err.message })
  }
}

const criarCategoria = async (req, res) => {
  const id_usuario = req.usuarioId

  const { mercadoId } = req.params
  const { nome } = req.body

  if (!nome?.trim())
    return res.status(400).json({ erro: 'O nome da categoria é obrigatório.' })

  try {
    const sql = await conectar()

    const [permissao] = await sql`
      SELECT papel FROM usuarios_mercados
      WHERE id_usuario = ${id_usuario}
        AND id_mercado = ${Number(mercadoId)}
    `
    if (!permissao)
      return res.status(403).json({ erro: 'Você não tem acesso a este mercado.' })

    const [nova] = await sql`
      INSERT INTO categorias (nome, id_mercado)
      VALUES (${nome.trim()}, ${Number(mercadoId)})
      RETURNING id_categoria AS id, nome
    `

    res.status(201).json(nova)
  } catch (err) {
    console.error('ERRO criarCategoria:', err)
    res.status(500).json({ erro: err.message })
  }
}

const atualizarCategoria = async (req, res) => {
  const id_usuario = req.usuarioId

  const { mercadoId, categoriaId } = req.params
  const { nome } = req.body

  if (!nome?.trim())
    return res.status(400).json({ erro: 'O nome da categoria é obrigatório.' })

  try {
    const sql = await conectar()

    const [permissao] = await sql`
      SELECT papel FROM usuarios_mercados
      WHERE id_usuario = ${id_usuario}
        AND id_mercado = ${Number(mercadoId)}
    `
    if (!permissao)
      return res.status(403).json({ erro: 'Você não tem acesso a este mercado.' })

    const [atualizada] = await sql`
      UPDATE categorias
      SET nome = ${nome.trim()}
      WHERE id_categoria = ${Number(categoriaId)}
        AND id_mercado = ${Number(mercadoId)}
      RETURNING id_categoria AS id, nome
    `

    if (!atualizada)
      return res.status(404).json({ erro: 'Categoria não encontrada.' })

    res.status(200).json(atualizada)
  } catch (err) {
    console.error('ERRO atualizarCategoria:', err)
    res.status(500).json({ erro: err.message })
  }
}

const deletarCategoria = async (req, res) => {
  const id_usuario = req.usuarioId

  const { mercadoId, categoriaId } = req.params

  try {
    const sql = await conectar()

    const [permissao] = await sql`
      SELECT papel FROM usuarios_mercados
      WHERE id_usuario = ${id_usuario}
        AND id_mercado = ${Number(mercadoId)}
    `
    if (!permissao)
      return res.status(403).json({ erro: 'Você não tem acesso a este mercado.' })

    // Deleta produtos da categoria primeiro
    await sql`DELETE FROM produtos WHERE id_categoria = ${Number(categoriaId)}`

    const [deletada] = await sql`
      DELETE FROM categorias
      WHERE id_categoria = ${Number(categoriaId)}
        AND id_mercado = ${Number(mercadoId)}
      RETURNING id_categoria
    `

    if (!deletada)
      return res.status(404).json({ erro: 'Categoria não encontrada.' })

    res.status(200).json({ mensagem: 'Categoria removida com sucesso.' })
  } catch (err) {
    console.error('ERRO deletarCategoria:', err)
    res.status(500).json({ erro: err.message })
  }
}

module.exports = { listarCategorias, criarCategoria, atualizarCategoria, deletarCategoria }
