const { conectar } = require('../db/neon');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { validarSenha, validarEmail, validarTelefone } = require('../utils/validators');
const { enviarEmailVerificacao } = require('../utils/mailer');

// Armazena temporariamente os cadastros pendentes
const cadastrosPendentes = new Map();

const signUp = async (req, res) => {
  const { nome, email, senha, telefone, confirmarSenha } = req.body;

  if (!req.body) return res.status(400).json({ erro: 'Body inválido' });
  if (!nome || !email || !senha || !telefone || !confirmarSenha)
    return res.status(400).json({ erro: 'Todos os campos são obrigatórios' });
  const emailValido = await validarEmail(email);
  if (!emailValido) return res.status(400).json({ erro: 'Email inválido ou domínio inexistente' });
  if (!validarTelefone(telefone)) return res.status(400).json({ erro: 'Telefone inválido' });
  if (senha !== confirmarSenha) return res.status(400).json({ erro: 'As senhas não coincidem' });

  const errosSenha = Array.isArray(validarSenha(senha)) ? validarSenha(senha) : [];
  if (errosSenha.length > 0) return res.status(400).json({ erros: errosSenha });

  try {
    const sql = await conectar();

    // Verifica se email já existe no banco
    const existente = await sql`SELECT id_usuario FROM usuarios WHERE email = ${email}`;
    if (existente.length > 0) return res.status(409).json({ erro: 'Email já cadastrado' });

    const senhaHash = await bcrypt.hash(senha, 10);
    const token = crypto.randomBytes(32).toString('hex');
    const expiracao = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

    // Salva temporariamente em memória (não no banco ainda)
    cadastrosPendentes.set(token, {
      nome,
      email,
      senhaHash,
      telefone,
      expiracao,
    });

    try {
      await enviarEmailVerificacao(email, token);
      console.log('✅ Email enviado para:', email);
    } catch (emailErr) {
      console.error('❌ Erro ao enviar email:', emailErr);
      return res.status(500).json({ erro: 'Erro ao enviar email de verificação' });
    }

    res.status(201).json({ mensagem: 'Verifique seu email para concluir o cadastro.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao registrar usuário' });
  }
};

const verificarEmail = async (req, res) => {
  const { token } = req.query;

  if (!token) return res.status(400).json({ erro: 'Token não informado' });

  const pendente = cadastrosPendentes.get(token);

  if (!pendente) return res.status(400).json({ erro: 'Token inválido ou expirado' });

  if (new Date() > new Date(pendente.expiracao)) {
    cadastrosPendentes.delete(token);
    return res.status(400).json({ erro: 'Token expirado. Faça o cadastro novamente.' });
  }

  try {
    // Agora sim salva no banco
    await sql`
      INSERT INTO usuarios (nome, email, senha, telefone, email_verificado)
      VALUES (${pendente.nome}, ${pendente.email}, ${pendente.senhaHash}, ${pendente.telefone}, TRUE)
    `;

    cadastrosPendentes.delete(token); // remove da memória

    res.json({ mensagem: 'Email verificado com sucesso! Você já pode fazer login.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao confirmar cadastro' });
  }
};
const signIn = async (req, res) => {
  const { email, senha } = req.body;

  if (!email || !senha)
    return res.status(400).json({ erro: 'Email e senha são obrigatórios' });
  // ✅ ADICIONE ISSO antes do res.json
  const token = jwt.sign(
    { id: usuario.id_usuario, email: usuario.email },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  )
  try {
    const sql = await conectar();
    const resultado = await sql`
      SELECT id_usuario, nome, email, senha, email_verificado FROM usuarios
      WHERE email = ${email}
    `;

    if (resultado.length === 0)
      return res.status(401).json({ erro: 'Email ou senha incorretos' });

    const usuario = resultado[0];

    // Bloqueia login se email não verificado
    if (!usuario.email_verificado)
      return res.status(403).json({ erro: 'Verifique seu email antes de fazer login.' });

    const senhaValida = await bcrypt.compare(senha, usuario.senha);
    if (!senhaValida)
      return res.status(401).json({ erro: 'Email ou senha incorretos' });

    delete usuario.senha;
    delete usuario.email_verificado;

    res.json({ mensagem: 'Login realizado com sucesso', usuario });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao realizar login' });
  }

};


module.exports = { signUp, signIn, verificarEmail }; 