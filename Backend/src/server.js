const express = require('express')
const cors    = require('cors')
const path    = require('path')
require('dotenv').config()

const authRoutes             = require('./routes/authRoutes.js')
const marketRoutes           = require('./routes/marketRoutes.js')
const usuariosMercadosRoutes = require('./routes/usuariosMercadosRoutes.js')
const produtoRoutes          = require('./routes/produtoRoutes.js')
const categoriaRoutes        = require('./routes/categoriaRoutes.js')

const app  = express()
const PORT = process.env.PORT || 3001

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173'
app.use(cors({ origin: [FRONTEND_URL, 'http://localhost:5173'] }))
app.use(express.json({ limit: '10mb' }))

app.use('/api/auth',              authRoutes)
app.use('/api/mercados',          marketRoutes)
app.use('/api/usuarios-mercados', usuariosMercadosRoutes)

app.use('/api/mercados/:mercadoId/categorias',                          categoriaRoutes)
app.use('/api/mercados/:mercadoId/categorias/:categoriaId/produtos',    produtoRoutes)

app.use(express.static(path.join(__dirname, '..', 'Frontend', 'dist')))

app.get('/{*splat}', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'Frontend', 'dist', 'index.html'))
})

app.listen(PORT, () => {
  console.log(`✅ Backend rodando na porta ${PORT}`)
})