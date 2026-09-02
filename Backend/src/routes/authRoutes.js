const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const limiter = require('../middleware/rateLimiter');
const { signUp, signIn, verificarEmail, esqueciSenha,confirmarTrocaSenha,redefinirSenha,solicitarTrocaSenha, getPerfil, atualizarPerfil } = require('../controllers/authController');

function autenticar(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ erro: 'Token não enviado' });
  const token = auth.split(' ')[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.usuarioId = payload.id;
    next();
  } catch {
    return res.status(401).json({ erro: 'Token inválido' });
  }
}

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