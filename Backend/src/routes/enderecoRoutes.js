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

router.get('/',    autenticar, listarEnderecos);
router.post('/',   autenticar, criarEndereco);
router.put('/:id/principal', autenticar, definirPrincipal);
router.put('/:id',    autenticar, atualizarEndereco);
router.delete('/:id', autenticar, removerEndereco);

module.exports = router;
