const express = require('express')
const router  = express.Router({ mergeParams: true })

const {
  criarProduto,
  listarProdutos,
  atualizarProduto,
  deletarProduto,
} = require('../controllers/produtoController')

// Mesmo padrão do marketController — sem middleware, auth feita dentro do controller
router.get('/',              listarProdutos)
router.post('/',             criarProduto)
router.put('/:produtoId',    atualizarProduto)
router.delete('/:produtoId', deletarProduto)

module.exports = router