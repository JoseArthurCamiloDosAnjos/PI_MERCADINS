const express = require('express');
const router = express.Router();
const autenticar = require('../middleware/authMiddleware');
const { atualizarStatusPedido, meusPedidos, detalharPedido, cancelarPedido, itensParaRecompra, removerDoHistorico } = require('../controllers/pedidoController');

router.get('/meus',   autenticar, meusPedidos);
router.get('/:id',    autenticar, detalharPedido);
router.put('/:id/status', autenticar, atualizarStatusPedido);
router.post('/:id/cancelar', autenticar, cancelarPedido);
router.get('/:id/itens-recompra', autenticar, itensParaRecompra);
router.delete('/:id/historico', autenticar, removerDoHistorico);

module.exports = router;
