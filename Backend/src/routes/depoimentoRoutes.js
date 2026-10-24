const express = require('express');
const router = express.Router();
const autenticar = require('../middleware/authMiddleware');
const autenticarOpcional = require('../middleware/authOpcionalMiddleware');
const { listarDepoimentos, criarDepoimento } = require('../controllers/depoimentoController');

// GET /api/depoimentos — depoimentos visíveis (público). Opcional: se houver
// token válido, devolve "minha" no depoimento de quem está logado
router.get('/', autenticarOpcional, listarDepoimentos);
// POST /api/depoimentos — o cliente escreve/edi o próprio depoimento (logado)
router.post('/', autenticar, criarDepoimento);

module.exports = router;
