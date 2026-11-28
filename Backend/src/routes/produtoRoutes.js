const express = require('express')
const router  = express.Router({ mergeParams: true })
const autenticar = require('../middleware/authMiddleware')
const autenticarOpcional = require('../middleware/authOpcionalMiddleware')

const {
  criarProduto,
  listarProdutos,
  atualizarProduto,
  deletarProduto,
} = require('../controllers/produtoController')
const {
  listarAvaliacoesProduto,
  criarAvaliacaoProduto,
  editarAvaliacaoProduto,
  removerAvaliacaoProduto,
  alternarVisibilidadeAvaliacaoProduto,
} = require('../controllers/avaliacaoController')

router.get('/',                                listarProdutos)
router.post('/',                               autenticar, criarProduto)
router.get('/:produtoId/avaliacoes',           autenticarOpcional, listarAvaliacoesProduto)
router.post('/:produtoId/avaliacoes',          autenticar, criarAvaliacaoProduto)
router.patch('/:produtoId/avaliacoes/:avaliacaoId', autenticar, editarAvaliacaoProduto)
router.delete('/:produtoId/avaliacoes/:avaliacaoId', autenticar, removerAvaliacaoProduto)
router.put('/:produtoId/avaliacoes/:avaliacaoId', autenticar, alternarVisibilidadeAvaliacaoProduto)
router.put('/:produtoId',                      autenticar, atualizarProduto)
router.delete('/:produtoId',                   autenticar, deletarProduto)

module.exports = router