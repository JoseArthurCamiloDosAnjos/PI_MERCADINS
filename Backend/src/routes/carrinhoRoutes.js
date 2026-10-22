const express = require('express');
const router = express.Router({ mergeParams: true });
const authMiddleware = require('../middleware/authMiddleware');
const { buscarCarrinho, salvarCarrinho, limparCarrinho } = require('../controllers/carrinhoController');

// O id do mercado vem na URL: /api/carrinho/:mercadoId
router.get('/:mercadoId',    authMiddleware, buscarCarrinho);
router.put('/:mercadoId',    authMiddleware, salvarCarrinho);
router.delete('/:mercadoId', authMiddleware, limparCarrinho);

module.exports = router;
