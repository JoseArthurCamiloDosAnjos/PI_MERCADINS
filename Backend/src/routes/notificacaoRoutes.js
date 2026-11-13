const express = require('express');
const router = express.Router();
const autenticar = require('../middleware/authMiddleware');
const limiter = require('../middleware/rateLimiter');
const {
  listar,
  enviarTeste,
  marcarComoLida,
  marcarTodasComoLidas,
} = require('../controllers/notificacaoController');

router.get('/', autenticar, listar);
router.post('/teste', autenticar, limiter(5, 15 * 60 * 1000), enviarTeste);
router.post('/lidas', autenticar, marcarTodasComoLidas);
router.post('/:id/lida', autenticar, marcarComoLida);

module.exports = router;
