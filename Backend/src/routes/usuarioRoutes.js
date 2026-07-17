const express = require('express');
const router = express.Router();
const { listarFavoritos, listarAvaliacoes, listarHistorico } = require('../controllers/usuarioController');

router.get('/favoritos',   listarFavoritos);
router.get('/avaliacoes',  listarAvaliacoes);
router.get('/historico',   listarHistorico);

module.exports = router;
