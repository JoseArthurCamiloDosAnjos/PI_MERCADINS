const express = require('express');
const router = express.Router();
const { conectar } = require('../db/neon');
const path = require('path');
const { signUp, signIn, verificarEmail, esqueciSenha, redefinirSenha } = require('../controllers/authController');

// REGISTER
router.post('/register', signUp);
// LOGIN
router.post('/login', signIn);
router.get('/verificar-email', verificarEmail);
router.post('/esqueci-senha', esqueciSenha);
router.post('redefinir-senha', redefinirSenha);
module.exports = router;