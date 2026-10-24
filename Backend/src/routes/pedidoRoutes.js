const express = require('express');
const router = express.Router();
const autenticar = require('../middleware/authMiddleware');
const { atualizarStatusPedido, meusPedidos, detalharPedido, cancelarPedido, itensParaRecompra } = require('../controllers/pedidoController');

// GET /api/pedidos/meus — pedidos que o cliente fez (acompanhamento B4)
router.get('/meus',   autenticar, meusPedidos);
// GET /api/pedidos/:id — detalhe de um pedido (cliente dono ou vendedor da loja)
router.get('/:id',    autenticar, detalharPedido);
// PUT /api/pedidos/:id/status — vendedor avança o status do pedido
router.put('/:id/status', autenticar, atualizarStatusPedido);
// POST /api/pedidos/:id/cancelar — cliente cancela o próprio pedido (se ainda der tempo)
router.post('/:id/cancelar', autenticar, cancelarPedido);
// GET /api/pedidos/:id/itens-recompra — produtos do pedido com preço/estoque
// atuais, para o cliente montar o carrinho de novo (recomprar)
router.get('/:id/itens-recompra', autenticar, itensParaRecompra);

module.exports = router;
