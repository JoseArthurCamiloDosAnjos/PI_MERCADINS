const express = require('express');
const router = express.Router();
const { conectar } = require('../db/neon');
const path = require('path');
const {criarMercado, listarMercados, buscarMercadoPorId, atualizarMercado, deletarMercado} = require('../controllers/marketController')

router.post('/registerMarket', criarMercado);

router.get("/showmarkets", listarMercados);

router.put("/atualizar/:id", atualizarMercado);


module.exports = router;