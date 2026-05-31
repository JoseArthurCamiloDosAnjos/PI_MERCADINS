const express = require('express');
const router = express.Router();
const { criarMercado, listarMercados, buscarMercadoPorId, atualizarMercado, deletarMercado } = require('../controllers/marketController');

router.post('/',           criarMercado);
router.get('/',            listarMercados);
router.get('/:id',         buscarMercadoPorId);
router.put('/:id',         atualizarMercado);
router.delete('/:id',      deletarMercado);

module.exports = router;