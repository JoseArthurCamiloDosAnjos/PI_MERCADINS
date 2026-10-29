const express = require('express')
const cors    = require('cors')
require('dotenv').config()

const authRoutes             = require('./routes/authRoutes.js')
const marketRoutes           = require('./routes/marketRoutes.js')
const usuariosMercadosRoutes = require('./routes/usuariosMercadosRoutes.js')
const produtoRoutes          = require('./routes/produtoRoutes.js')
const categoriaRoutes        = require('./routes/categoriaRoutes.js')
const usuarioRoutes          = require('./routes/usuarioRoutes.js')
const carrinhoRoutes         = require('./routes/carrinhoRoutes.js')
const pedidoRoutes           = require('./routes/pedidoRoutes.js')
const depoimentoRoutes       = require('./routes/depoimentoRoutes.js')
const buscaRoutes            = require('./routes/buscaRoutes.js')
const adminRoutes            = require('./routes/adminRoutes.js')
const assinaturaRoutes       = require('./routes/assinaturaRoutes.js')
const { webhookAsaas }       = require('./controllers/assinaturaController.js')
const { conectar }           = require('./db/neon.js')
const { encerrarVencidas }   = require('./services/vigenciaService.js')

const app  = express()
const PORT = process.env.PORT || 3001
const isProduction = process.env.NODE_ENV === 'production' || !!process.env.RENDER

// ── HTTPS redirect ───────────────────────────────────────────────────────────
// Render, Heroku, Vercel etc. usam proxy reverso — o header x-forwarded-proto
// indica o protocolo original. Em produção, redireciona HTTP → HTTPS.
app.use((req, res, next) => {
  if (isProduction && req.headers['x-forwarded-proto'] !== 'https') {
    return res.redirect(301, `https://${req.headers.host}${req.url}`)
  }
  next()
})

// ── Security headers ─────────────────────────────────────────────────────────
app.use((_req, res, next) => {
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('X-XSS-Protection', '1; mode=block')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  next()
})

// ── CORS ─────────────────────────────────────────────────────────────────────
const envOrigins = process.env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()).filter(Boolean) || []
const frontendUrl = process.env.FRONTEND_URL?.trim()

const allowedOrigins = [
  ...new Set([
    ...envOrigins,
    frontendUrl,
    'https://mercadins.com.br',
    'https://www.mercadins.com.br',
    // localhost só em desenvolvimento
    ...(!isProduction ? ['http://localhost:5173', 'http://localhost:3001'] : []),
  ].filter(Boolean)),
]

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true)
    } else {
      console.error(`CORS bloqueado: ${origin}`)
      callback(new Error('Origem não permitida pelo CORS'))
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['X-Total-Count'],
  credentials: true,
  maxAge: 86400,
}))

// ── Body parsers ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }))

// ── Health check ─────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// ── API routes ───────────────────────────────────────────────────────────────
app.use('/api/auth',              authRoutes)
app.use('/api/mercados',          marketRoutes)
app.use('/api/usuarios-mercados', usuariosMercadosRoutes)
app.use('/api/usuario',           usuarioRoutes)
app.use('/api/carrinho',          carrinhoRoutes)
app.use('/api/pedidos',           pedidoRoutes)
app.use('/api/depoimentos',       depoimentoRoutes)
app.use('/api/busca',            buscaRoutes)

app.use('/api/admin',              adminRoutes)

app.use('/api/mercados/:mercadoId/categorias',                          categoriaRoutes)
app.use('/api/mercados/:mercadoId/categorias/:categoriaId/produtos',    produtoRoutes)

app.use('/api/assinaturas',        assinaturaRoutes)
app.post('/api/webhooks/asaas',    webhookAsaas)

// ── Diagnóstico de pagamento (público, sem segredos) ──────────────────────────
// Devolve só a PRESENÇA das variáveis do Asaas — resolve em 10 segundos a
// dúvida "o ambiente (Render x local) está configurado?". Nenhum valor é exposto.
app.get('/api/saude/pagamentos', (_req, res) => {
  res.json({
    ambiente: isProduction ? 'producao' : 'desenvolvimento',
    banco: process.env.DB_PROVIDER || 'auto',
    asaas: {
      url_usada: (isProduction ? process.env.Assas_API_URL_Producao : process.env.Assas_API_URL_Sandbox) || null,
      url_producao: !!process.env.Assas_API_URL_Producao,
      url_sandbox: !!process.env.Assas_API_URL_Sandbox,
      chave_api: !!process.env.Assas_API_KEY,
      webhook_token: !!process.env.ASAAS_WEBHOOK_TOKEN,
    },
    frontend_url: process.env.FRONTEND_URL || null,
  })
})

// ── Sitemap dinâmico (SEO - C6): páginas institucionais + vitrines ativas ─────
app.use('/',                   require('./routes/sitemapRoutes'))

// ── 404 para rotas de API não encontradas ─────────────────────────────────────
app.use('/api', (_req, res) => {
  res.status(404).json({ erro: 'Rota da API não encontrada' })
})

// ── 404: qualquer rota que não seja API ───────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ erro: 'Rota não encontrada. Esta é apenas a API.' })
})

// ── Error handler ────────────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('Erro:', err.message)
  if (err.message === 'Origem não permitida pelo CORS') {
    return res.status(403).json({ erro: 'Origem não permitida pelo CORS' })
  }
  res.status(500).json({ erro: 'Erro interno do servidor' })
})

app.listen(PORT, () => {
  console.log(`Backend rodando na porta ${PORT} [${isProduction ? 'produção' : 'desenvolvimento'}]`)
  checarVigencia()
})
      
app.post('/api/assistant/chat', async (req, res) => {
  try {
    const { message } = req.body || {}

    if (typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({
        error: 'Digite uma mensagem válida.',
      })
    }

    const webhookUrl = process.env.N8N_WEBHOOK_URL

    if (!webhookUrl) {
      return res.status(500).json({
        error: 'N8N_WEBHOOK_URL não configurada no servidor.',
      })
    }

    const resposta = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: message.trim(),
      }),
    })

    const corpo = await resposta.text()

    if (!resposta.ok) {
      console.error('Erro do n8n:', resposta.status, corpo)

      return res.status(502).json({
        error: 'O agente do n8n não conseguiu responder.',
      })
    }

    let dados

    try {
      dados = JSON.parse(corpo)
    } catch {
      console.error('Resposta inválida recebida do n8n:', corpo)

      return res.status(502).json({
        error: 'O n8n retornou uma resposta inválida.',
      })
    }

    const reply =
      dados.reply ??
      dados.output ??
      dados.text ??
      dados.result?.content

    if (typeof reply !== 'string' || !reply.trim()) {
      console.error('Formato inesperado do n8n:', dados)

      return res.status(502).json({
        error: 'O agente não retornou uma mensagem válida.',
      })
    }

    return res.json({ reply })
  } catch (err) {
    console.error('Erro ao conectar ao n8n:', err.message)

    return res.status(500).json({
      error: 'Erro ao conectar ao assistente.',
    })
  }
})

// ── Vigência das assinaturas ──────────────────────────────────────────────────
// A cada hora (e já na subida do servidor) encerra assinaturas vencidas +
// carência e suspende os mercados vinculados até o pagamento ser regularizado.
// Idempotente: rodar mais de uma vez não causa efeito colateral.
async function checarVigencia() {
  try {
    const sql = await conectar()
    const encerradas = await encerrarVencidas(sql)
    if (encerradas.length > 0) {
      const suspensos = encerradas.reduce((t, a) => t + (a.mercados_suspensos || 0), 0)
      console.log(
        `Vigência: ${encerradas.length} assinatura(s) vencida(s), ${suspensos} mercado(s) suspenso(s)`
      )
    }
  } catch (err) {
    console.error('Erro na verificação de vigência das assinaturas:', err.message)
  }
}

setInterval(checarVigencia, 60 * 60 * 1000)
