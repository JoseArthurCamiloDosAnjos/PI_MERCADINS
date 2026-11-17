const express = require('express');
const router = express.Router();
const autenticar = require('../middleware/authMiddleware');
const limiter = require('../middleware/rateLimiter');
const { signUp, signIn, verificarEmail, reenviarCodigoVerificacao, esqueciSenha, reenviarRecuperacao, confirmarTrocaSenha,redefinirSenha,solicitarTrocaSenha, getPerfil, atualizarPerfil, solicitarTrocaEmail, confirmarTrocaEmail, verificar2FA, reenviarCodigo2FA } = require('../controllers/authController');

router.post('/register',        limiter(5, 15 * 60 * 1000), signUp);
router.post('/login',           limiter(10, 60 * 1000), signIn);
router.get('/perfil',           autenticar, getPerfil);
router.post('/verificar-email',  limiter(5, 15 * 60 * 1000), verificarEmail);
router.post('/reenviar-verificacao', limiter(3, 15 * 60 * 1000), reenviarCodigoVerificacao);
router.post('/esqueci-senha',   limiter(3, 15 * 60 * 1000), esqueciSenha);
router.post('/reenviar-recuperacao', limiter(3, 15 * 60 * 1000), reenviarRecuperacao);
router.post('/redefinir-senha', limiter(5, 15 * 60 * 1000), redefinirSenha);
router.post('/trocar-senha', autenticar, limiter(5, 15 * 60 * 1000), solicitarTrocaSenha);
router.post('/confirmar-troca-senha', limiter(5, 15 * 60 * 1000), confirmarTrocaSenha);
router.post('/solicitar-troca-email', autenticar, limiter(5, 15 * 60 * 1000), solicitarTrocaEmail);
router.post('/confirmar-troca-email', autenticar, limiter(5, 15 * 60 * 1000), confirmarTrocaEmail);
router.put('/perfil', autenticar, atualizarPerfil);

// ── Verificação em duas etapas (2FA) — obrigatória para todos ─────────────────
router.post('/2fa/verificar', limiter(5, 15 * 60 * 1000), verificar2FA);
router.post('/2fa/reenviar',  limiter(3, 15 * 60 * 1000), reenviarCodigo2FA);

module.exports = router;