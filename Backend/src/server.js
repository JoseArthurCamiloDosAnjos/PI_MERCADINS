const express = require('express')
const cors    = require('cors')
const path    = require('path')
require('dotenv').config()

const authRoutes             = require('./routes/authRoutes.js')
const marketRoutes           = require('./routes/marketRoutes.js')
const usuariosMercadosRoutes = require('./routes/usuariosMercadosRoutes.js')
const produtoRoutes          = require('./routes/produtoRoutes.js')
const categoriaRoutes        = require('./routes/categoriaRoutes.js')
const usuarioRoutes          = require('./routes/usuarioRoutes.js')
const carrinhoRoutes         = require('./routes/carrinhoRoutes.js')

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

// ── Static files ─────────────────────────────────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads'), {
  maxAge: '1d',
  immutable: true,
}))

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

app.use('/api/mercados/:mercadoId/categorias',                          categoriaRoutes)
app.use('/api/mercados/:mercadoId/categorias/:categoriaId/produtos',    produtoRoutes)

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
  console.log(`✅ Backend rodando na porta ${PORT} [${isProduction ? 'produção' : 'desenvolvimento'}]`)
})
