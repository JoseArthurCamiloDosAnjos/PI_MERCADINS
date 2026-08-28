const express = require('express');
const router = express.Router();
const autenticar = require('../middleware/authMiddleware');
const { listarFavoritos, listarAvaliacoes, listarHistorico } = require('../controllers/usuarioController');

router.get('/favoritos',   autenticar, listarFavoritos);
router.get('/avaliacoes',  autenticar, listarAvaliacoes);
router.get('/historico',   autenticar, listarHistorico);

module.exports = router;
