const express = require('express');
const router = express.Router();
const { buscarProdutos } = require('../controllers/buscaController');

router.get('/produtos', buscarProdutos);

module.exports = router;
