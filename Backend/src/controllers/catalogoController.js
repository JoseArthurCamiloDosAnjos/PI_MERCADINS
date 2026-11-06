const { conectar } = require('../db/neon')

// ── Tipos de loja ────────────────────────────────────────────────────────────
// Mesmos valores de CATEGORIAS_VALIDAS do marketController + 'geral'
// (item que aparece para qualquer tipo de loja).
const TIPOS_LOJA = [
  'geral',
  'mercado', 'hortifruti', 'acougue', 'padaria', 'bebidas', 'organicos', 'conveniencia',
]

const MAX_IMAGENS = 8
const MAX_DESCRICAO = 500
const MAX_NOME = 150

function parsePreco(valor) {
  if (typeof valor === 'number') return valor
  if (typeof valor !== 'string') return 0
  const num = Number(valor.replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(num) ? num : 0
}

// Valida o corpo de criação/edição. `parcial` (edição) permite campos ausentes.
function validarCorpo(body, { parcial = false } = {}) {
  const erros = []

  if (!parcial || body.nome !== undefined) {
    const nome = String(body.nome ?? '').trim()
    if (!nome) erros.push('Informe o nome do produto.')
    else if (nome.length > MAX_NOME) erros.push(`Nome pode ter no máximo ${MAX_NOME} caracteres.`)
  }

  if (!parcial || body.descricao !== undefined) {
    const descricao = String(body.descricao ?? '')
    if (descricao.length > MAX_DESCRICAO) {
      erros.push(`Descrição pode ter no máximo ${MAX_DESCRICAO} caracteres.`)
    }
  }

  if (!parcial || body.tipo_loja !== undefined) {
    const tipo = String(body.tipo_loja ?? '').trim().toLowerCase()
    if (!TIPOS_LOJA.includes(tipo)) erros.push('Tipo de loja inválido.')
  }

  if (body.imagens !== undefined) {
    if (!Array.isArray(body.imagens)) {
      erros.push('Imagens devem ser uma lista de URLs.')
    } else {
      if (body.imagens.length > MAX_IMAGENS) {
        erros.push(`Máximo de ${MAX_IMAGENS} imagens.`)
      }
      const invalida = body.imagens.find(
        (u) => typeof u !== 'string' || u.length > 2000 || !u.trim()
      )
      if (invalida !== undefined) erros.push('URL de imagem inválida.')
    }
  }

  if (body.preco_sugerido !== undefined) {
    const preco = parsePreco(body.preco_sugerido)
    if (!Number.isFinite(preco) || preco < 0 || preco > 99999999) {
      erros.push('Preço sugerido inválido.')
    }
  }

  return erros
}

// ─────────────────────────────────────────────
// GET /api/catalogo?p=tipo
// Público — itens ATIVOS do catálogo para o vendedor escolher.
// Com ?tipo=x, devolve os itens daquele tipo + os 'geral'.
// ─────────────────────────────────────────────

const listarCatalogo = async (req, res) => {
  try {
    const sql = await conectar()
    const tipo = String(req.query.tipo ?? '').trim().toLowerCase()

    const itens = await sql`
      SELECT id, nome, descricao, imagens, preco_sugerido, tipo_loja, criado_em
      FROM produtos_catalogo
      WHERE ativo = TRUE
        AND (
          ${TIPOS_LOJA.includes(tipo) && tipo !== 'geral' ? tipo : null}::text IS NULL
          OR tipo_loja = ${TIPOS_LOJA.includes(tipo) && tipo !== 'geral' ? tipo : null}::text
          OR tipo_loja = 'geral'
        )
      ORDER BY nome
    `

    res.status(200).json(itens)
  } catch (err) {
    console.error('ERRO listarCatalogo:', err)
    res.status(500).json({ erro: err.message })
  }
}

// ─────────────────────────────────────────────
// GET /api/admin/catalogo
// Admin — TODOS os itens (inclusive inativos) para o painel.
// ─────────────────────────────────────────────

const listarCatalogoAdmin = async (_req, res) => {
  try {
    const sql = await conectar()

    const itens = await sql`
      SELECT id, nome, descricao, imagens, preco_sugerido, tipo_loja, ativo,
             criado_em, atualizado_em
      FROM produtos_catalogo
      ORDER BY criado_em DESC, id DESC
    `

    res.status(200).json(itens)
  } catch (err) {
    console.error('ERRO listarCatalogoAdmin:', err)
    res.status(500).json({ erro: err.message })
  }
}

// ─────────────────────────────────────────────
// POST /api/admin/catalogo
// ─────────────────────────────────────────────

const criarItemCatalogo = async (req, res) => {
  try {
    const erros = validarCorpo(req.body)
    if (erros.length) return res.status(400).json({ erro: erros[0] })

    const sql = await conectar()

    const nome = String(req.body.nome).trim()
    const descricao = String(req.body.descricao ?? '').trim()
    const imagens = Array.isArray(req.body.imagens) ? req.body.imagens : []
    const preco = parsePreco(req.body.preco_sugerido)
    const tipo = String(req.body.tipo_loja).trim().toLowerCase()

    const [item] = await sql`
      INSERT INTO produtos_catalogo (nome, descricao, imagens, preco_sugerido, tipo_loja)
      VALUES (${nome}, ${descricao}, ${imagens}, ${preco}, ${tipo})
      RETURNING *
    `

    res.status(201).json(item)
  } catch (err) {
    console.error('ERRO criarItemCatalogo:', err)
    res.status(500).json({ erro: err.message })
  }
}

// ─────────────────────────────────────────────
// PUT /api/admin/catalogo/:id
// ─────────────────────────────────────────────

const atualizarItemCatalogo = async (req, res) => {
  try {
    const id = Number(req.params.id)
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ erro: 'Identificador inválido.' })
    }

    const erros = validarCorpo(req.body, { parcial: true })
    if (erros.length) return res.status(400).json({ erro: erros[0] })

    const sql = await conectar()

    const [atual] = await sql`SELECT * FROM produtos_catalogo WHERE id = ${id}`
    if (!atual) return res.status(404).json({ erro: 'Item do catálogo não encontrado.' })

    const nome = req.body.nome !== undefined ? String(req.body.nome).trim() : atual.nome
    const descricao =
      req.body.descricao !== undefined ? String(req.body.descricao).trim() : atual.descricao
    const imagens =
      req.body.imagens !== undefined && Array.isArray(req.body.imagens)
        ? req.body.imagens
        : atual.imagens
    const preco =
      req.body.preco_sugerido !== undefined
        ? parsePreco(req.body.preco_sugerido)
        : Number(atual.preco_sugerido)
    const tipo =
      req.body.tipo_loja !== undefined
        ? String(req.body.tipo_loja).trim().toLowerCase()
        : atual.tipo_loja
    const ativo = req.body.ativo !== undefined ? Boolean(req.body.ativo) : atual.ativo

    const [item] = await sql`
      UPDATE produtos_catalogo
      SET nome = ${nome},
          descricao = ${descricao},
          imagens = ${imagens},
          preco_sugerido = ${preco},
          tipo_loja = ${tipo},
          ativo = ${ativo},
          atualizado_em = NOW()
      WHERE id = ${id}
      RETURNING *
    `

    res.status(200).json(item)
  } catch (err) {
    console.error('ERRO atualizarItemCatalogo:', err)
    res.status(500).json({ erro: err.message })
  }
}

// ─────────────────────────────────────────────
// DELETE /api/admin/catalogo/:id
// ─────────────────────────────────────────────

const deletarItemCatalogo = async (req, res) => {
  try {
    const id = Number(req.params.id)
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ erro: 'Identificador inválido.' })
    }

    const sql = await conectar()

    const [removido] = await sql`
      DELETE FROM produtos_catalogo WHERE id = ${id} RETURNING id
    `
    if (!removido) return res.status(404).json({ erro: 'Item do catálogo não encontrado.' })

    res.status(200).json({ ok: true })
  } catch (err) {
    console.error('ERRO deletarItemCatalogo:', err)
    res.status(500).json({ erro: err.message })
  }
}

module.exports = {
  TIPOS_LOJA,
  listarCatalogo,
  listarCatalogoAdmin,
  criarItemCatalogo,
  atualizarItemCatalogo,
  deletarItemCatalogo,
}
