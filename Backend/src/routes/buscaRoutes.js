const express = require('express');
const router = express.Router();
const { buscarProdutos } = require('../controllers/buscaController');

// GET /api/busca/produtos?q=termo — busca produtos em todos os mercados
router.get('/produtos', buscarProdutos);

module.exports = router;
