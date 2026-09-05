const express = require('express');
const router = express.Router();
const autenticar = require('../middleware/authMiddleware');
const { meusMercados } = require('../controllers/usuariosMercadosController');

router.get('/meus', autenticar, meusMercados);

module.exports = router;