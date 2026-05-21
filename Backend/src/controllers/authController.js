const { conectar } = require("../db/neon");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const {
  validarSenha,
  validarEmail,
  validarTelefone,
} = require("../utils/validators");
const { enviarEmailVerificacao, enviarEmailRecuperacao } = require("../utils/mailer");

// Armazena temporariamente os cadastros pendentes
const cadastrosPendentes = new Map();

const signUp = async (req, res) => {
  const { nome, email, senha, telefone, confirmarSenha } = req.body;

  if (!req.body) return res.status(400).json({ erro: "Body inválido" });
  if (!nome || !email || !senha || !telefone || !confirmarSenha)
    return res.status(400).json({ erro: "Todos os campos são obrigatórios" });
  const emailValido = await validarEmail(email);
  if (!emailValido)
    return res
      .status(400)
      .json({ erro: "Email inválido ou domínio inexistente" });
  if (!validarTelefone(telefone))
    return res.status(400).json({ erro: "Telefone inválido" });
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

    const senhaHash = await bcrypt.hash(senha, 10);
    const token = crypto.randomBytes(32).toString("hex");
    const expiracao = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // ✅ Salva direto no banco com email_verificado = FALSE
    await sql`
      INSERT INTO usuarios (nome, email, senha, telefone, email_verificado, token_verificacao, token_expiracao)
      VALUES (${nome}, ${email}, ${senhaHash}, ${telefone}, FALSE, ${token}, ${expiracao})
    `;

    await enviarEmailVerificacao(email, token);
    console.log("✅ Email enviado para:", email);

    res
      .status(201)
      .json({ mensagem: "Verifique seu email para concluir o cadastro." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: "Erro ao registrar usuário" });
  }
};

// verificarEmail — busca no banco
const verificarEmail = async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).json({ erro: "Token não informado" });

  try {
    const sql = await conectar();

    const [usuario] = await sql`
      SELECT id_usuario, token_expiracao FROM usuarios
      WHERE token_verificacao = ${token} AND email_verificado = FALSE
    `;

    if (!usuario)
      return res.status(400).json({ erro: "Token inválido ou expirado" });

    if (new Date() > new Date(usuario.token_expiracao)) {
      return res
        .status(400)
        .json({ erro: "Token expirado. Faça o cadastro novamente." });
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
      SELECT id_usuario, nome, email, senha, email_verificado 
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
        email_verificado: usuario.email_verificado,
      },
      token,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: "Erro ao realizar login" });
  }
};

module.exports = { signUp, signIn, verificarEmail };

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

      return res.status(404).json({
        erro: "Usuário não encontrado"
      });
    }

    // gera token
    const token =
      crypto.randomBytes(32).toString("hex");

    // expira em 1 hora
    const expiracao =
      new Date(Date.now() + 60 * 60 * 1000);

    // salva token
    await sql`
      UPDATE usuarios
      SET token_verificacao = ${token},
          token_expiracao = ${expiracao}
      WHERE email = ${email}
    `;

    // envia email
    await enviarEmailRecuperacao(
      email,
      token
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

const redefinirSenha =
  async (req, res) => {

    const {
      token,
      novaSenha,
      confirmarSenha
    } = req.body;

    if (
      !token ||
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
        WHERE token_verificacao = ${token}
      `;

      if (usuario.length === 0) {

        return res.status(400).json({
          erro: "Token inválido"
        });
      }

      const user = usuario[0];

      // token expirado
      if (
        new Date() >
        new Date(user.token_expiracao)
      ) {

        return res.status(400).json({
          erro: "Token expirado"
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
module.exports = {
  signUp,
  signIn,
  verificarEmail,
  esqueciSenha,
  redefinirSenha
};
