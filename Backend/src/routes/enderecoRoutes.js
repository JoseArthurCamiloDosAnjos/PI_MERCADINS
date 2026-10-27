const express = require('express');
const router = express.Router();
const autenticar = require('../middleware/authMiddleware');
const {
  listarEnderecos,
  criarEndereco,
  atualizarEndereco,
  definirPrincipal,
  removerEndereco,
} = require('../controllers/enderecoController');

// Só o usuário logado enxerga os próprios endereços
router.get('/',    autenticar, listarEnderecos);
router.post('/',   autenticar, criarEndereco);
// O ":id/principal" vem antes do ":id" para não ser engolido pela rota de edição
router.put('/:id/principal', autenticar, definirPrincipal);
router.put('/:id',    autenticar, atualizarEndereco);
router.delete('/:id', autenticar, removerEndereco);

module.exports = router;
