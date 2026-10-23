const express = require('express');
const router = express.Router();
const autenticar = require('../middleware/authMiddleware');
const autenticarOpcional = require('../middleware/authOpcionalMiddleware');
const { criarMercado, listarMercados, buscarMercadoPorId, buscarMercadoPorSlug, atualizarMercado, deletarMercado, meusMercados, dashboardMercado } = require('../controllers/marketController');
const { favoritarMercado } = require('../controllers/usuarioController');
const { listarAvaliacoesMercado, criarAvaliacao, alternarVisibilidadeAvaliacao, listarAvaliacoesProdutosDoMercado } = require('../controllers/avaliacaoController');
const { criarPedido, listarPedidosMercado, financeiroMercado } = require('../controllers/pedidoController');
const { listarCupons, criarCupom, atualizarCupom, deletarCupom, validarCupomNoCarrinho } = require('../controllers/cupomController');

router.post('/',            autenticar, criarMercado);
router.get('/',             listarMercados);
router.get('/meus',         autenticar, meusMercados);
router.get('/slug/:slug',   autenticarOpcional, buscarMercadoPorSlug);
router.post('/:id/pedidos', autenticar, criarPedido);
router.get('/:id/pedidos',  autenticar, listarPedidosMercado);
router.get('/:id/financeiro', autenticar, financeiroMercado);
router.post('/:id/favoritar',  autenticar, favoritarMercado);
router.delete('/:id/favoritar', autenticar, favoritarMercado);
router.get('/:id/avaliacoes',  autenticarOpcional, listarAvaliacoesMercado);
router.post('/:id/avaliacoes', autenticar, criarAvaliacao);
// B6 — Moderação: vendedor/admin oculta ou exibe uma avaliação da loja
router.put('/:id/avaliacoes/:avaliacaoId', autenticar, alternarVisibilidadeAvaliacao);
// B6 — Painel do vendedor: avaliações de produtos da loja (para moderar)
router.get('/:id/avaliacoes-produtos', autenticar, listarAvaliacoesProdutosDoMercado);
// Cupons de desconto (B3): CRUD do vendedor + validação no carrinho do cliente
router.get('/:id/cupons',          autenticar, listarCupons);
router.post('/:id/cupons',         autenticar, criarCupom);
router.post('/:id/cupons/validar', autenticar, validarCupomNoCarrinho);
router.put('/:id/cupons/:cupomId',    autenticar, atualizarCupom);
router.delete('/:id/cupons/:cupomId', autenticar, deletarCupom);
router.get('/:id',          autenticarOpcional, buscarMercadoPorId);
router.get('/:id/dashboard', autenticar, dashboardMercado);
router.put('/:id',          autenticar, atualizarMercado);
router.delete('/:id',       autenticar, deletarMercado);

module.exports = router;