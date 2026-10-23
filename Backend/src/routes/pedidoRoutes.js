const express = require('express');
const router = express.Router();
const autenticar = require('../middleware/authMiddleware');
const { atualizarStatusPedido, meusPedidos, detalharPedido } = require('../controllers/pedidoController');

// GET /api/pedidos/meus — pedidos que o cliente fez (acompanhamento B4)
router.get('/meus',   autenticar, meusPedidos);
// GET /api/pedidos/:id — detalhe de um pedido (cliente dono ou vendedor da loja)
router.get('/:id',    autenticar, detalharPedido);
// PUT /api/pedidos/:id/status — vendedor avança o status do pedido
router.put('/:id/status', autenticar, atualizarStatusPedido);

module.exports = router;
