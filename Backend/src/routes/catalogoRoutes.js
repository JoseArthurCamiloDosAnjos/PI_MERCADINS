const { Router } = require('express')
const { listarCatalogo } = require('../controllers/catalogoController')

const router = Router()

// Público: o vendedor precisa estar logado para usar o catálogo na vitrine,
// mas o conteúdo em si é genérico (nome/fotos/descrição de produtos) e não
// expõe dado de ninguém — a leitura fica aberta como as outras listagens.
router.get('/', listarCatalogo)

module.exports = router
