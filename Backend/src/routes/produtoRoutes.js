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
  alternarVisibilidadeAvaliacaoProduto,
} = require('../controllers/avaliacaoController')

router.get('/',                                listarProdutos)
router.post('/',                               autenticar, criarProduto)
router.get('/:produtoId/avaliacoes',           autenticarOpcional, listarAvaliacoesProduto)
router.post('/:produtoId/avaliacoes',          autenticar, criarAvaliacaoProduto)
// B6 — Moderação: vendedor/admin oculta ou exibe uma avaliação de produto
router.put('/:produtoId/avaliacoes/:avaliacaoId', autenticar, alternarVisibilidadeAvaliacaoProduto)
router.put('/:produtoId',                      autenticar, atualizarProduto)
router.delete('/:produtoId',                   autenticar, deletarProduto)

module.exports = router