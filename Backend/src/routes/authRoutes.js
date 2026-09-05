const express = require('express');
const router = express.Router();
const autenticar = require('../middleware/authMiddleware');
const limiter = require('../middleware/rateLimiter');
const { signUp, signIn, verificarEmail, esqueciSenha,confirmarTrocaSenha,redefinirSenha,solicitarTrocaSenha, getPerfil, atualizarPerfil } = require('../controllers/authController');

router.post('/register',        limiter(5, 15 * 60 * 1000), signUp);
router.post('/login',           limiter(10, 15 * 60 * 1000), signIn);
router.get('/perfil',           autenticar, getPerfil);
router.post('/verificar-email',  limiter(5, 15 * 60 * 1000), verificarEmail);
router.post('/esqueci-senha',   limiter(3, 15 * 60 * 1000), esqueciSenha);
router.post('/redefinir-senha', limiter(5, 15 * 60 * 1000), redefinirSenha);
router.post('/trocar-senha', autenticar, limiter(5, 15 * 60 * 1000), solicitarTrocaSenha);
router.post('/confirmar-troca-senha', limiter(5, 15 * 60 * 1000), confirmarTrocaSenha);
router.put('/perfil', autenticar, atualizarPerfil);

module.exports = router;