const express = require('express');
const router = express.Router();
const { meusMercados } = require('../controllers/usuariosMercadosController');

router.get('/meus', meusMercados);

module.exports = router;