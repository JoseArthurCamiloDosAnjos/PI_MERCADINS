const express = require('express');
const router = express.Router();
const autenticar = require('../middleware/authMiddleware');
const { criarCheckout, minhaAssinatura, cancelarAssinatura } = require('../controllers/assinaturaController');

router.post('/checkout',     autenticar, criarCheckout);
router.get('/minha',         autenticar, minhaAssinatura);
router.post('/:id/cancelar', autenticar, cancelarAssinatura);

module.exports = router;
