const express = require('express')
const cors    = require('cors')
require('dotenv').config()

const authRoutes           = require('./routes/authRoutes.js')
const marketRoutes         = require('./routes/marketRoutes.js')
const usuariosMercadosRoutes = require('./routes/usuariosMercadosRoutes.js')
const produtoRoutes        = require('./routes/produtoRoutes.js')

const app  = express()
const PORT = process.env.PORT || 3001

app.use(cors({ origin: 'http://localhost:5173' }))
app.use(express.json({ limit: '10mb' })) // limit maior para aceitar imagens em base64

app.use('/api/auth',            authRoutes)
app.use('/api/mercados',        marketRoutes)
app.use('/api/usuarios-mercados', usuariosMercadosRoutes)

// Rota de produtos — aninhada sob mercados > categorias
app.use(
  '/api/mercados/:mercadoId/categorias/:categoriaId/produtos',
  produtoRoutes
)

app.listen(PORT, () => {
  console.log(`✅ Backend rodando em http://localhost:${PORT}`)
})