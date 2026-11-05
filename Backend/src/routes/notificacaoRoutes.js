const express = require('express');
const router = express.Router();
const autenticar = require('../middleware/authMiddleware');
const { listar, enviarTeste } = require('../controllers/notificacaoController');

router.get('/', autenticar, listar);
router.post('/teste', autenticar, enviarTeste);

module.exports = router;
