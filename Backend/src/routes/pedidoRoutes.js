const express = require('express');
const router = express.Router();
const autenticar = require('../middleware/authMiddleware');
const { atualizarStatusPedido } = require('../controllers/pedidoController');

// PUT /api/pedidos/:id/status — vendedor avança o status do pedido
router.put('/:id/status', autenticar, atualizarStatusPedido);

module.exports = router;
