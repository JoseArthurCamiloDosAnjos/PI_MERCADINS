const express = require('express');
const router = express.Router();
const autenticar = require('../middleware/authMiddleware');
const { criarMercado, listarMercados, buscarMercadoPorId, buscarMercadoPorSlug, atualizarMercado, deletarMercado, meusMercados, dashboardMercado } = require('../controllers/marketController');

router.post('/',            autenticar, criarMercado);
router.get('/',             listarMercados);
router.get('/meus',         autenticar, meusMercados);
router.get('/slug/:slug',   buscarMercadoPorSlug);
router.get('/:id',          buscarMercadoPorId);
router.get('/:id/dashboard', autenticar, dashboardMercado);
router.put('/:id',          autenticar, atualizarMercado);
router.delete('/:id',       autenticar, deletarMercado);

module.exports = router;