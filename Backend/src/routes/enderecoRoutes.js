const express = require('express');
const router = express.Router();
const autenticar = require('../middleware/authMiddleware');
const { listarEnderecos, criarEndereco, removerEndereco } = require('../controllers/enderecoController');

// Só o usuário logado enxerga os próprios endereços
router.get('/',    autenticar, listarEnderecos);
router.post('/',   autenticar, criarEndereco);
router.delete('/:id', autenticar, removerEndereco);

module.exports = router;
