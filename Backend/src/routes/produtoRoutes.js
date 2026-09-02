const express = require('express')
const router  = express.Router({ mergeParams: true })
const autenticar = require('../middleware/authMiddleware')

const {
  criarProduto,
  listarProdutos,
  atualizarProduto,
  deletarProduto,
} = require('../controllers/produtoController')

router.get('/',              listarProdutos)
router.post('/',             autenticar, criarProduto)
router.put('/:produtoId',    autenticar, atualizarProduto)
router.delete('/:produtoId', autenticar, deletarProduto)

module.exports = router