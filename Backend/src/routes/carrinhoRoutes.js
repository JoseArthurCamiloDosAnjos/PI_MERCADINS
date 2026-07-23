const express = require('express');
const router = express.Router({ mergeParams: true });
const authMiddleware = require('../middleware/authMiddleware');
const { buscarCarrinho, salvarCarrinho, limparCarrinho } = require('../controllers/carrinhoController');

router.get('/',    authMiddleware, buscarCarrinho);
router.put('/',    authMiddleware, salvarCarrinho);
router.delete('/', authMiddleware, limparCarrinho);

module.exports = router;
