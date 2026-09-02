const { conectar } = require("../db/neon");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const {
  validarSenha,
  validarEmail,
  validarTelefone,
  validarCPF,
} = require("../utils/validators");
const { enviarEmailVerificacao, enviarEmailRecuperacao } = require("../utils/mailer");

// Armazena temporariamente os cadastros pendentes
const cadastrosPendentes = new Map();

const signUp = async (req, res) => {
  const { nome, email, senha, telefone, cpf, confirmarSenha } = req.body;

  if (!req.body) return res.status(400).json({ erro: "Body inválido" });
  if (!nome || !email || !senha || !telefone || !cpf || !confirmarSenha)
    return res.status(400).json({ erro: "Todos os campos são obrigatórios" });
  const emailValido = await validarEmail(email);
  if (!emailValido)
    return res
      .status(400)
      .json({ erro: "Email inválido ou domínio inexistente" });
  if (!validarTelefone(telefone))
    return res.status(400).json({ erro: "Telefone inválido" });
  if (!validarCPF(cpf))
    return res.status(400).json({ erro: "CPF inválido" });
  if (senha !== confirmarSenha)
    return res.status(400).json({ erro: "As senhas não coincidem" });

  const errosSenha = Array.isArray(validarSenha(senha))
    ? validarSenha(senha)
    : [];
  if (errosSenha.length > 0) return res.status(400).json({ erros: errosSenha });

  try {
    const sql = await conectar();

    const existente =
      await sql`SELECT id_usuario FROM usuarios WHERE email = ${email}`;
    if (existente.length > 0)
      return res.status(409).json({ erro: "Email já cadastrado" });

    const cpfLimpo = cpf.replace(/\D/g, '');
    const existenteCpf =
      await sql`SELECT id_usuario FROM usuarios WHERE cpf = ${cpfLimpo}`;
    if (existenteCpf.length > 0)
      return res.status(409).json({ erro: "CPF já cadastrado" });

    const senhaHash = await bcrypt.hash(senha, 10);
    const codigoVerificacao = Math.floor(100000 + Math.random() * 900000).toString();
    const expiracao = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await sql`
      INSERT INTO usuarios (nome, email, senha, telefone, cpf, email_verificado, token_verificacao, token_expiracao)
      VALUES (${nome}, ${email}, ${senhaHash}, ${telefone}, ${cpfLimpo}, FALSE, ${codigoVerificacao}, ${expiracao})
    `;

    await enviarEmailVerificacao(email, codigoVerificacao);
    console.log("✅ Email enviado para:", email);

    res
      .status(201)
      .json({ mensagem: "Verifique seu email para concluir o cadastro." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: "Erro ao registrar usuário" });
  }
};

// verificarEmail — busca no banco por código
const verificarEmail = async (req, res) => {
  const { codigo } = req.body;
  if (!codigo) return res.status(400).json({ erro: "Código não informado" });

  try {
    const sql = await conectar();

    const [usuario] = await sql`
      SELECT id_usuario, token_expiracao FROM usuarios
      WHERE token_verificacao = ${codigo} AND email_verificado = FALSE
    `;

    if (!usuario)
      return res.status(400).json({ erro: "Código inválido ou expirado" });

    if (new Date() > new Date(usuario.token_expiracao)) {
      return res
        .status(400)
        .json({ erro: "Código expirado. Faça o cadastro novamente." });
    }

    await sql`
      UPDATE usuarios
      SET email_verificado = TRUE, token_verificacao = NULL, token_expiracao = NULL
      WHERE id_usuario = ${usuario.id_usuario}
    `;

    res.json({
      mensagem: "Email verificado com sucesso! Você já pode fazer login.",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: "Erro ao confirmar cadastro" });
  }
};
const signIn = async (req, res) => {
  const { email, senha } = req.body;

  if (!email || !senha)
    return res.status(400).json({ erro: "Email e senha são obrigatórios" });

  try {
    const sql = await conectar(); // ← ADICIONE ISSO

    const resultado = await sql`
      SELECT id_usuario, nome, email, cpf, senha, email_verificado, foto_perfil
      FROM usuarios WHERE email = ${email}
    `;

    if (resultado.length === 0)
      return res.status(401).json({ erro: "Email ou senha incorretos" });

    const usuario = resultado[0]; // ← define aqui

    if (!usuario.email_verificado)
      return res
        .status(403)
        .json({ erro: "Verifique seu email antes de fazer login." });

    const senhaValida = await bcrypt.compare(senha, usuario.senha);
    if (!senhaValida)
      return res.status(401).json({ erro: "Email ou senha incorretos" });

    const token = jwt.sign(
      { id: usuario.id_usuario, email: usuario.email },
      process.env.JWT_SECRET,
      { expiresIn: "7d" },
    );

    res.json({
      usuario: {
        id_usuario: usuario.id_usuario,
        nome: usuario.nome,
        email: usuario.email,
        cpf: usuario.cpf ?? '',
        email_verificado: usuario.email_verificado,
        foto_perfil: usuario.foto_perfil ?? '',
      },
      token,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: "Erro ao realizar login" });
  }
};
const confirmarTrocaSenha = async (req, res) => {
  const { codigo } = req.body;
  if (!codigo) return res.status(400).json({ erro: 'Código não informado.' });

  try {
    const sql = await conectar();

    // busca pelo código (que está concatenado com a hash)
    const [usuario] = await sql`
      SELECT id_usuario, token_verificacao, token_expiracao
      FROM usuarios
      WHERE token_verificacao LIKE ${codigo + '|%'}
    `;

    if (!usuario) return res.status(400).json({ erro: 'Código inválido.' });
    if (new Date() > new Date(usuario.token_expiracao))
      return res.status(400).json({ erro: 'Código expirado.' });

    const novaSenhaHash = usuario.token_verificacao.split('|')[1];

    await sql`
      UPDATE usuarios SET
        senha             = ${novaSenhaHash},
        token_verificacao = NULL,
        token_expiracao   = NULL
      WHERE id_usuario = ${usuario.id_usuario}
    `;

    res.json({ mensagem: 'Senha atualizada com sucesso!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao confirmar troca de senha.' });
  }
};

const esqueciSenha = async (req, res) => {

  const { email } = req.body;

  if (!email) {
    return res.status(400).json({
      erro: "Email obrigatório"
    });
  }

  try {

    const sql = await conectar();

    const usuario = await sql`
      SELECT id_usuario
      FROM usuarios
      WHERE email = ${email}
    `;

    if (usuario.length === 0) {
      return res.json({
        mensagem:
          "Se o email estiver cadastrado, você receberá um código de recuperação."
      });
    }

    // gera código numérico de 6 dígitos
    const codigo =
      Math.floor(100000 + Math.random() * 900000).toString();

    // expira em 15 minutos
    const expiracao =
      new Date(Date.now() + 15 * 60 * 1000);

    // salva código
    await sql`
      UPDATE usuarios
      SET token_verificacao = ${codigo},
          token_expiracao = ${expiracao}
      WHERE email = ${email}
    `;

    // envia email com código
    await enviarEmailRecuperacao(
      email,
      codigo
    );

    res.json({
      mensagem:
        "Email de recuperação enviado"
    });

  } catch (err) {

    console.error(err);

    res.status(500).json({
      erro:
        "Erro ao enviar recuperação"
    });
  }
};
const getPerfil = async (req, res) => {
  try {
    const sql = await conectar();
    const [usuario] = await sql`
      SELECT id_usuario, nome, email, cpf, telefone, email_verificado, foto_perfil
      FROM usuarios
      WHERE id_usuario = ${req.usuarioId}
    `;
    if (!usuario) return res.status(404).json({ erro: 'Usuário não encontrado' });
    res.json(usuario);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao buscar perfil' });
  }
};
const redefinirSenha =
  async (req, res) => {

    const {
      codigo,
      novaSenha,
      confirmarSenha
    } = req.body;

    if (
      !codigo ||
      !novaSenha ||
      !confirmarSenha
    ) {

      return res.status(400).json({
        erro:
          "Todos os campos são obrigatórios"
      });
    }

    if (novaSenha !== confirmarSenha) {

      return res.status(400).json({
        erro:
          "As senhas não coincidem"
      });
    }

    const errosSenha =
      Array.isArray(validarSenha(novaSenha))
        ? validarSenha(novaSenha)
        : [];

    if (errosSenha.length > 0) {

      return res.status(400).json({
        erros: errosSenha
      });
    }

    try {

      const sql = await conectar();

      const usuario = await sql`
        SELECT
          id_usuario,
          token_expiracao
        FROM usuarios
        WHERE token_verificacao = ${codigo}
      `;

      if (usuario.length === 0) {

        return res.status(400).json({
          erro: "Código inválido"
        });
      }

      const user = usuario[0];

      // código expirado
      if (
        new Date() >
        new Date(user.token_expiracao)
      ) {

        return res.status(400).json({
          erro: "Código expirado. Solicite um novo código."
        });
      }

      // hash senha
      const senhaHash =
        await bcrypt.hash(
          novaSenha,
          10
        );

      // atualiza senha
      await sql`
        UPDATE usuarios
        SET senha = ${senhaHash},
            token_verificacao = NULL,
            token_expiracao = NULL
        WHERE id_usuario = ${user.id_usuario}
      `;

      res.json({
        mensagem:
          "Senha redefinida com sucesso"
      });

    } catch (err) {

      console.error(err);

      res.status(500).json({
        erro:
          "Erro ao redefinir senha"
      });
    }
};
const atualizarPerfil = async (req, res) => {
  const { nome, email, telefone, foto_perfil_url } = req.body;

  const foto_perfil = foto_perfil_url || undefined

  try {
    const sql = await conectar();
    await sql`
      UPDATE usuarios SET nome = ${nome}, email = ${email}, telefone = ${telefone},
        foto_perfil = COALESCE(${foto_perfil ?? null}, foto_perfil)
      WHERE id_usuario = ${req.usuarioId}
    `;

    res.json({ mensagem: 'Perfil atualizado com sucesso' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao atualizar perfil' });
  }
};
const solicitarTrocaSenha = async (req, res) => {
  const { novaSenha, emailConfirmacao } = req.body;

  if (!novaSenha) return res.status(400).json({ erro: 'Nova senha obrigatória.' });
  if (!emailConfirmacao) return res.status(400).json({ erro: 'Email de confirmação obrigatório.' });

  const emailConfirmacaoValido = await validarEmail(emailConfirmacao);
  if (!emailConfirmacaoValido)
    return res.status(400).json({ erro: 'Email de confirmação inválido ou domínio inexistente.' });

  const errosSenha = Array.isArray(validarSenha(novaSenha)) ? validarSenha(novaSenha) : [];
  if (errosSenha.length > 0) return res.status(400).json({ erros: errosSenha });

  try {
    const sql = await conectar();
    const [usuario] = await sql`SELECT id_usuario, email FROM usuarios WHERE id_usuario = ${req.usuarioId}`;
    if (!usuario) return res.status(404).json({ erro: 'Usuário não encontrado.' });

    if (emailConfirmacao.toLowerCase() !== usuario.email.toLowerCase()) {
      return res.status(400).json({ erro: 'O email de confirmação deve ser o mesmo da sua conta.' });
    }

    // gera código numérico de 6 dígitos
    const codigo = Math.floor(100000 + Math.random() * 900000).toString();
    const novaSenhaHash = await bcrypt.hash(novaSenha, 10);
    const expiracao = new Date(Date.now() + 15 * 60 * 1000);

    // salva código + hash concatenados separados por "|"
    await sql`
      UPDATE usuarios SET
        token_verificacao = ${codigo + '|' + novaSenhaHash},
        token_expiracao   = ${expiracao}
      WHERE id_usuario = ${req.usuarioId}
    `;

    await enviarEmailRecuperacao(usuario.email, codigo);
    res.json({ mensagem: 'Código de confirmação enviado para seu email.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao solicitar troca de senha.' });
  }
};
module.exports = {
  signUp,
  signIn,
  verificarEmail,
  esqueciSenha,
  redefinirSenha,
  getPerfil,
  atualizarPerfil,
  solicitarTrocaSenha,
  confirmarTrocaSenha
};
