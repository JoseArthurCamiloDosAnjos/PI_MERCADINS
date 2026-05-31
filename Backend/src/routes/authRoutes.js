const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
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

router.post('/register',        signUp);
router.post('/login',           signIn);
router.get('/perfil',           autenticar, getPerfil);
router.get('/verificar-email',  verificarEmail);
router.post('/esqueci-senha',   esqueciSenha);
router.post('/redefinir-senha', redefinirSenha);
router.post('/trocar-senha', autenticar, solicitarTrocaSenha);
router.get('/confirmar-troca-senha', confirmarTrocaSenha);
router.put('/perfil', autenticar, atualizarPerfil);

module.exports = router;