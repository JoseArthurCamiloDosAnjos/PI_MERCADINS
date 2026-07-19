const express = require('express');
const router = express.Router();
const { criarMercado, listarMercados, buscarMercadoPorId, buscarMercadoPorSlug, atualizarMercado, deletarMercado, meusMercados, dashboardMercado } = require('../controllers/marketController');

router.post('/',                    criarMercado);
router.get('/',                     listarMercados);
router.get('/meus',                 meusMercados);
router.get('/slug/:slug',           buscarMercadoPorSlug);
router.get('/:id',                  buscarMercadoPorId);
router.get('/:id/dashboard',        dashboardMercado);
router.put('/:id',                  atualizarMercado);
router.delete('/:id',               deletarMercado);

module.exports = router;