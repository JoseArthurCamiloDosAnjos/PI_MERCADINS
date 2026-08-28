const express = require('express')
const router  = express.Router({ mergeParams: true })
const upload  = require('../middleware/upload')
const autenticar = require('../middleware/authMiddleware')

const {
  criarProduto,
  listarProdutos,
  atualizarProduto,
  deletarProduto,
} = require('../controllers/produtoController')

router.get('/',              listarProdutos)
router.post('/',             autenticar, upload.array('imagens', 10), criarProduto)
router.put('/:produtoId',    autenticar, upload.array('imagens', 10), atualizarProduto)
router.delete('/:produtoId', autenticar, deletarProduto)

module.exports = router