const express = require('express')
const router  = express.Router({ mergeParams: true })
const autenticar = require('../middleware/authMiddleware')

const {
  listarCategorias,
  criarCategoria,
  atualizarCategoria,
  deletarCategoria,
} = require('../controllers/categoriaController')

router.get('/',              listarCategorias)
router.post('/',             autenticar, criarCategoria)
router.put('/:categoriaId',  autenticar, atualizarCategoria)
router.delete('/:categoriaId', autenticar, deletarCategoria)

module.exports = router
