const express = require('express');
const router = express.Router();
const { conectar } = require('../db/neon');
const path = require('path');
const { signUp, signIn, verificarEmail, esqueciSenha, redefinirSenha } = require('../controllers/authController');

router.get('/', (req, res) => {
  res.sendFile(path.join(__dirname,'../public/pages/login.html'));
});


router.get('/register', (req, res) => {
  res.sendFile(path.join(__dirname,'../public/pages/register.html'));
});
// REGISTER
router.post('/register', signUp);
// LOGIN
router.post('/login', signIn);
router.get('/verificar-email', verificarEmail);
router.post('/esqueci-senha', esqueciSenha);
router.post('redefinir-senha', redefinirSenha);
module.exports = router;