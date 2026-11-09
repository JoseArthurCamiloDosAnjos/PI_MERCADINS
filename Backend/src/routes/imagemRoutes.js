const { Router } = require('express');
const autenticar = require('../middleware/authMiddleware');
const { enviarImagem, buscarImagem } = require('../controllers/imagemController');

const router = Router();

router.post('/', autenticar, enviarImagem);
router.get('/:id', buscarImagem);

module.exports = router;
