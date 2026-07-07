const express = require('express')
const router  = express.Router({ mergeParams: true })

const {
  listarCategorias,
  criarCategoria,
  atualizarCategoria,
  deletarCategoria,
} = require('../controllers/categoriaController')

router.get('/',              listarCategorias)
router.post('/',             criarCategoria)
router.put('/:categoriaId',  atualizarCategoria)
router.delete('/:categoriaId', deletarCategoria)

module.exports = router
