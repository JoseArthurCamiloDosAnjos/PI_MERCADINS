const express = require('express');
const router = express.Router();
const autenticar = require('../middleware/authMiddleware');
const autenticarOpcional = require('../middleware/authOpcionalMiddleware');
const { listarDepoimentos, criarDepoimento } = require('../controllers/depoimentoController');

router.get('/', autenticarOpcional, listarDepoimentos);
router.post('/', autenticar, criarDepoimento);

module.exports = router;
