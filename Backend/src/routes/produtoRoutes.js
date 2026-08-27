const express = require('express')
const router  = express.Router({ mergeParams: true })
const upload  = require('../middleware/upload')

const {
  criarProduto,
  listarProdutos,
  atualizarProduto,
  deletarProduto,
} = require('../controllers/produtoController')

router.get('/',              listarProdutos)
router.post('/',             upload.array('imagens', 10), criarProduto)
router.put('/:produtoId',    upload.array('imagens', 10), atualizarProduto)
router.delete('/:produtoId', deletarProduto)

module.exports = router