const express = require('express');
const router = express.Router();
const autenticar = require('../middleware/authMiddleware');
const autenticarOpcional = require('../middleware/authOpcionalMiddleware');
const { criarMercado, listarMercados, buscarMercadoPorId, buscarMercadoPorSlug, atualizarMercado, deletarMercado, meusMercados, dashboardMercado } = require('../controllers/marketController');
const { favoritarMercado } = require('../controllers/usuarioController');
const { listarAvaliacoesMercado, criarAvaliacao } = require('../controllers/avaliacaoController');
const { criarPedido, listarPedidosMercado } = require('../controllers/pedidoController');

router.post('/',            autenticar, criarMercado);
router.get('/',             listarMercados);
router.get('/meus',         autenticar, meusMercados);
router.get('/slug/:slug',   autenticarOpcional, buscarMercadoPorSlug);
router.post('/:id/pedidos', autenticar, criarPedido);
router.get('/:id/pedidos',  autenticar, listarPedidosMercado);
router.post('/:id/favoritar',  autenticar, favoritarMercado);
router.delete('/:id/favoritar', autenticar, favoritarMercado);
router.get('/:id/avaliacoes',  autenticarOpcional, listarAvaliacoesMercado);
router.post('/:id/avaliacoes', autenticar, criarAvaliacao);
router.get('/:id',          autenticarOpcional, buscarMercadoPorId);
router.get('/:id/dashboard', autenticar, dashboardMercado);
router.put('/:id',          autenticar, atualizarMercado);
router.delete('/:id',       autenticar, deletarMercado);

module.exports = router;