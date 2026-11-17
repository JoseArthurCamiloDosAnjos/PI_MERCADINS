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
const { enviarEmailVerificacao, enviarEmail2FA, enviarEmailRecuperacao, enviarEmailTrocaEmail } = require("../utils/mailer");
const { VERSAO_TERMOS, MENSAGEM_ACEITE_OBRIGATORIO } = require("../utils/termos");
const { enviarNotificacao } = require("../utils/notificacoes");

const cadastrosPendentes = new Map();

// Código numérico de 6 dígitos criptograficamente seguro (Math.random é
// previsível e não deve gerar tokens de verificação/recuperação).
function codigoSeguro6() {
  return crypto.randomInt(100000, 1000000).toString();
}

const normalizarFrontendUrl = (url) => {
  let base = (url || "").trim() || "https://mercadins.com.br";
  base = base.replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(base)) base = `https://${base}`;
  const host = base.replace(/^https?:\/\//i, "").split(/[/?#]/)[0];
  const isLocal = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(host);
  if (!isLocal) base = base.replace(/^http:\/\//i, "https://");
  return base;
};

const signUp = async (req, res) => {
  const { nome, email, senha, telefone, cpf, data_nascimento, confirmarSenha } = req.body;

  if (!req.body) return res.status(400).json({ erro: "Body inválido" });
  if (!nome || !email || !senha || !telefone || !cpf || !confirmarSenha)
    return res.status(400).json({ erro: "Todos os campos são obrigatórios" });
  if (req.body.aceite_termos !== true)
    return res.status(400).json({ erro: MENSAGEM_ACEITE_OBRIGATORIO });
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
    const codigoVerificacao = codigoSeguro6();
    const expiracao = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const [novoUsuario] = await sql`
      INSERT INTO usuarios (nome, email, senha, telefone, cpf, data_nascimento, email_verificado, token_verificacao, token_expiracao, termos_aceitos_em, termos_versao, termos_ip)
      VALUES (${nome}, ${email}, ${senhaHash}, ${telefone}, ${cpfLimpo}, ${data_nascimento || null}, FALSE, ${codigoVerificacao}, ${expiracao}, NOW(), ${VERSAO_TERMOS}, ${String(req.ip || '').slice(0, 80)})
      RETURNING id_usuario
    `;

    enviarNotificacao(sql, {
      id_usuario: novoUsuario?.id_usuario ?? null,
      email,
      tipo: 'cadastro',
      titulo: 'Cadastro realizado',
      mensagem: `Olá, ${nome.split(' ')[0]}! Seu cadastro no Mercadins foi realizado com sucesso. Confirme seu e-mail para ativar a conta e começar a comprar.`,
      enviarEmail: false,
    }).catch((err) => console.error('Falha na notificação de cadastro:', err.message));

    const frontendUrl = normalizarFrontendUrl(process.env.FRONTEND_URL);
    // O cadastro não deve falhar se o e-mail de verificação não puder ser enviado.
    // O usuário já está cadastrado; pode reenviar o código na tela de verificação.
    await enviarEmailVerificacao(email, codigoVerificacao, `${frontendUrl}/verificar-email?codigo=${codigoVerificacao}`).catch((err) => {
      console.error('Falha ao enviar e-mail de verificação:', err.message);
    });

    res
      .status(201)
      .json({ mensagem: "Verifique seu email para concluir o cadastro." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: "Erro ao registrar usuário" });
  }
};

const verificarEmail = async (req, res) => {
  const { codigo } = req.body;
  if (!codigo) return res.status(400).json({ erro: "Código não informado" });

  try {
    const sql = await conectar();

    const [usuario] = await sql`
      SELECT id_usuario, nome, email, telefone, token_expiracao FROM usuarios
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

    enviarNotificacao(sql, {
      id_usuario: usuario.id_usuario,
      email: usuario.email,
      tipo: 'email_confirmado',
      titulo: 'E-mail confirmado',
      mensagem: `Olá, ${String(usuario.nome || '').split(' ')[0]}! Seu e-mail foi confirmado com sucesso. Sua conta no Mercadins está ativa.`,
    }).catch((err) => console.error('Falha na notificação de e-mail:', err.message));

    res.json({
      mensagem: "Email verificado com sucesso! Você já pode fazer login.",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: "Erro ao confirmar cadastro" });
  }
};
const reenviarCodigoVerificacao = async (req, res) => {
  const { email } = req.body;

  if (!email) return res.status(400).json({ erro: "Email não informado" });

  try {
    const sql = await conectar();

    const [usuario] = await sql`
      SELECT id_usuario, email_verificado FROM usuarios
      WHERE email = ${email}
    `;

    if (!usuario)
      return res.status(404).json({ erro: "Email não encontrado" });

    if (usuario.email_verificado)
      return res.status(400).json({ erro: "Email já verificado. Faça o login." });

    const codigoVerificacao = codigoSeguro6();
    const expiracao = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await sql`
      UPDATE usuarios
      SET token_verificacao = ${codigoVerificacao}, token_expiracao = ${expiracao}
      WHERE id_usuario = ${usuario.id_usuario}
    `;

    const frontendUrl = normalizarFrontendUrl(process.env.FRONTEND_URL);
    await enviarEmailVerificacao(email, codigoVerificacao, `${frontendUrl}/verificar-email?codigo=${codigoVerificacao}`).catch((err) => {
      console.error('Falha ao reenviar e-mail de verificação:', err.message);
      throw err;
    });

    res.json({ mensagem: "Novo código enviado! Verifique seu email." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: "Erro ao reenviar código de verificação" });
  }
};

const signIn = async (req, res) => {
  const { email, senha } = req.body;

  if (!email || !senha)
    return res.status(400).json({ erro: "Email e senha são obrigatórios" });

  try {
    const sql = await conectar();

    const resultado = await sql`
      SELECT id_usuario, nome, email, cpf, telefone, data_nascimento, senha, email_verificado, foto_perfil, is_admin, status, email_admin, dois_fatores
      FROM usuarios WHERE email = ${email} OR email_admin = ${email}
    `;

    if (resultado.length === 0)
      return res.status(401).json({ erro: "Email ou senha incorretos" });

    const usuario = resultado[0];

    const is_admin_login = usuario.email_admin && email.toLowerCase() === usuario.email_admin.toLowerCase();

    const senhaValida = await bcrypt.compare(senha, usuario.senha);
    if (!senhaValida)
      return res.status(401).json({ erro: "Email ou senha incorretos" });

    if (!usuario.email_verificado)
      return res
        .status(403)
        .json({ erro: "Verifique seu email antes de fazer login." });

    if (usuario.status === 'bloqueado')
      return res.status(403).json({ erro: "Sua conta foi bloqueada. Entre em contato com o suporte." });

    if (usuario.status === 'inativo')
      return res.status(403).json({ erro: "Sua conta está desativada. Faça login novamente para reativar." });

    if (is_admin_login && !usuario.is_admin)
      return res.status(403).json({ erro: "Este email é de administrador. Faça login com seu email normal." });

    // ── Verificação em duas etapas (2FA) — obrigatória para todos ────
    // Todo login exige o código enviado por email. Na primeira vez o
    // cadastro é marcado como "dois_fatores" para fins de histórico.
    {
      const codigo = codigoSeguro6();
      const expiracao = new Date(Date.now() + 10 * 60 * 1000); // 10 minutos

      await sql`
        UPDATE usuarios SET
          dois_fatores_codigo = ${codigo},
          dois_fatores_expiracao = ${expiracao},
          dois_fatores_tentativas = 0
        WHERE id_usuario = ${usuario.id_usuario}
      `;

      try {
        await enviarEmail2FA(usuario.email, codigo);
      } catch (err) {
        console.error('Falha ao enviar código 2FA:', err.message);
        return res.status(502).json({
          erro: "Não foi possível enviar o código de verificação. Tente novamente em instantes.",
        });
      }

      // Token temporário de 10 minutos para completar o 2FA
      const tokenParcial = jwt.sign(
        { id: usuario.id_usuario, email: usuario.email, login_email: email, etapa: '2fa' },
        process.env.JWT_SECRET,
        { expiresIn: "10m" },
      );

      return res.json({
        requer_2fa: true,
        token_parcial: tokenParcial,
        mensagem: "Código de verificação enviado para seu email.",
      });
    }
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

    const codigo =
      codigoSeguro6();

    const expiracao =
      new Date(Date.now() + 15 * 60 * 1000);

    await sql`
      UPDATE usuarios
      SET token_verificacao = ${codigo},
          token_expiracao = ${expiracao}
      WHERE email = ${email}
    `;

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
const reenviarRecuperacao = async (req, res) => {
  const { email } = req.body;

  if (!email) return res.status(400).json({ erro: "Email obrigatório" });

  try {
    const sql = await conectar();

    const usuario = await sql`
      SELECT id_usuario FROM usuarios WHERE email = ${email}
    `;

    const mensagem =
      "Se o email estiver cadastrado, você receberá um código de recuperação.";
    if (usuario.length === 0) return res.json({ mensagem });

    const codigo = codigoSeguro6();
    const expiracao = new Date(Date.now() + 15 * 60 * 1000);

    await sql`
      UPDATE usuarios
      SET token_verificacao = ${codigo},
          token_expiracao = ${expiracao}
      WHERE id_usuario = ${usuario[0].id_usuario}
    `;

    await enviarEmailRecuperacao(email, codigo);

    res.json({ mensagem: "Novo código enviado! Verifique seu email." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: "Erro ao enviar recuperação" });
  }
};

const getPerfil = async (req, res) => {
  try {
    const sql = await conectar();
    const [usuario] = await sql`
      SELECT id_usuario, nome, email, cpf, telefone, data_nascimento, email_verificado, foto_perfil, is_admin, status, email_admin, dois_fatores
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

      if (
        new Date() >
        new Date(user.token_expiracao)
      ) {

        return res.status(400).json({
          erro: "Código expirado. Solicite um novo código."
        });
      }

      const senhaHash =
        await bcrypt.hash(
          novaSenha,
          10
        );

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
  const { nome, email, telefone, data_nascimento, foto_perfil_url } = req.body;

  if (!nome || !nome.trim()) return res.status(400).json({ erro: 'Nome é obrigatório.' });
  if (!email || !email.trim()) return res.status(400).json({ erro: 'Email é obrigatório.' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ erro: 'Email inválido.' });

  const foto_perfil = foto_perfil_url || undefined

  try {
    const sql = await conectar();

    const [existente] = await sql`SELECT id_usuario FROM usuarios WHERE email = ${email.trim().toLowerCase()} AND id_usuario != ${req.usuarioId}`;
    if (existente) return res.status(400).json({ erro: 'Este email já está em uso por outra conta.' });

    await sql`
      UPDATE usuarios SET nome = ${nome.trim()}, email = ${email.trim().toLowerCase()}, telefone = ${telefone},
        data_nascimento = ${data_nascimento || null},
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
  const { senhaAtual, novaSenha, emailConfirmacao } = req.body;

  if (!senhaAtual) return res.status(400).json({ erro: 'Senha atual obrigatória.' });
  if (!novaSenha) return res.status(400).json({ erro: 'Nova senha obrigatória.' });
  if (!emailConfirmacao) return res.status(400).json({ erro: 'Email de confirmação obrigatório.' });

  const emailConfirmacaoValido = await validarEmail(emailConfirmacao);
  if (!emailConfirmacaoValido)
    return res.status(400).json({ erro: 'Email de confirmação inválido ou domínio inexistente.' });

  const errosSenha = Array.isArray(validarSenha(novaSenha)) ? validarSenha(novaSenha) : [];
  if (errosSenha.length > 0) return res.status(400).json({ erros: errosSenha });

  try {
    const sql = await conectar();
    const [usuario] = await sql`SELECT id_usuario, email, senha FROM usuarios WHERE id_usuario = ${req.usuarioId}`;
    if (!usuario) return res.status(404).json({ erro: 'Usuário não encontrado.' });

    if (emailConfirmacao.toLowerCase() !== usuario.email.toLowerCase()) {
      return res.status(400).json({ erro: 'O email de confirmação deve ser o mesmo da sua conta.' });
    }

    const senhaValida = await bcrypt.compare(senhaAtual, usuario.senha);
    if (!senhaValida) {
      return res.status(400).json({ erro: 'Senha atual incorreta.' });
    }

    const codigo = codigoSeguro6();
    const novaSenhaHash = await bcrypt.hash(novaSenha, 10);
    const expiracao = new Date(Date.now() + 15 * 60 * 1000);

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

const solicitarTrocaEmail = async (req, res) => {
  const { novoEmail } = req.body;

  if (!novoEmail || !novoEmail.trim()) return res.status(400).json({ erro: 'Novo email é obrigatório.' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(novoEmail)) return res.status(400).json({ erro: 'Email inválido.' });

  const novoEmailFormatado = novoEmail.trim().toLowerCase();

  try {
    const sql = await conectar();

    const [usuario] = await sql`SELECT id_usuario, email FROM usuarios WHERE id_usuario = ${req.usuarioId}`;
    if (!usuario) return res.status(404).json({ erro: 'Usuário não encontrado.' });

    if (novoEmailFormatado === usuario.email.toLowerCase()) {
      return res.status(400).json({ erro: 'O novo email é igual ao atual.' });
    }

    const [existente] = await sql`SELECT id_usuario FROM usuarios WHERE email = ${novoEmailFormatado} AND id_usuario != ${req.usuarioId}`;
    if (existente) return res.status(400).json({ erro: 'Este email já está em uso por outra conta.' });

    const codigo = codigoSeguro6();
    const expiracao = new Date(Date.now() + 15 * 60 * 1000);

    await sql`
      UPDATE usuarios SET
        token_verificacao = ${codigo + '|' + novoEmailFormatado},
        token_expiracao = ${expiracao}
      WHERE id_usuario = ${req.usuarioId}
    `;

    await enviarEmailTrocaEmail(novoEmailFormatado, codigo);
    res.json({ mensagem: 'Código de confirmação enviado para o novo email.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao solicitar troca de email.' });
  }
};

const confirmarTrocaEmail = async (req, res) => {
  const { codigo } = req.body;
  if (!codigo) return res.status(400).json({ erro: 'Código não informado.' });

  try {
    const sql = await conectar();

    const [usuario] = await sql`
      SELECT id_usuario, token_verificacao, token_expiracao
      FROM usuarios
      WHERE id_usuario = ${req.usuarioId}
    `;

    if (!usuario || !usuario.token_verificacao) {
      return res.status(400).json({ erro: 'Nenhuma troca de email pendente.' });
    }

    if (new Date() > new Date(usuario.token_expiracao)) {
      await sql`
        UPDATE usuarios SET token_verificacao = NULL, token_expiracao = NULL
        WHERE id_usuario = ${req.usuarioId}
      `;
      return res.status(400).json({ erro: 'Código expirado. Solicite uma nova troca de email.' });
    }

    const [codigoSalvo, novoEmail] = usuario.token_verificacao.split('|');
    if (codigo !== codigoSalvo) {
      return res.status(400).json({ erro: 'Código inválido.' });
    }

    const [existente] = await sql`SELECT id_usuario FROM usuarios WHERE email = ${novoEmail} AND id_usuario != ${req.usuarioId}`;
    if (existente) {
      await sql`
        UPDATE usuarios SET token_verificacao = NULL, token_expiracao = NULL
        WHERE id_usuario = ${req.usuarioId}
      `;
      return res.status(400).json({ erro: 'Este email já está em uso por outra conta.' });
    }

    await sql`
      UPDATE usuarios SET
        email = ${novoEmail},
        token_verificacao = NULL,
        token_expiracao = NULL
      WHERE id_usuario = ${req.usuarioId}
    `;

    res.json({ mensagem: 'Email atualizado com sucesso!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao confirmar troca de email.' });
  }
};

// ── Verificação em duas etapas (2FA) ──────────────────────────────────────────

const verificar2FA = async (req, res) => {
  const { token_parcial, codigo } = req.body;
  if (!token_parcial || !codigo)
    return res.status(400).json({ erro: 'Token e código são obrigatórios.' });
  if (codigo.length !== 6)
    return res.status(400).json({ erro: 'O código deve ter 6 dígitos.' });

  try {
    // Verifica o token parcial (deve ter etapa '2fa')
    let payload;
    try {
      payload = jwt.verify(token_parcial, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ erro: 'Sessão expirada. Faça login novamente.' });
    }
    if (payload.etapa !== '2fa')
      return res.status(401).json({ erro: 'Token inválido.' });

    const sql = await conectar();
    const [usuario] = await sql`
      SELECT id_usuario, nome, email, cpf, telefone, data_nascimento,
             foto_perfil, is_admin, email_admin, email_verificado,
             dois_fatores_codigo, dois_fatores_expiracao, dois_fatores_tentativas
      FROM usuarios WHERE id_usuario = ${payload.id}
    `;

    if (!usuario || !usuario.dois_fatores_codigo)
      return res.status(400).json({ erro: 'Código inválido ou expirado.' });

    // Limite de 5 tentativas
    if ((usuario.dois_fatores_tentativas ?? 0) >= 5) {
      await sql`
        UPDATE usuarios SET dois_fatores_codigo = NULL, dois_fatores_expiracao = NULL
        WHERE id_usuario = ${usuario.id_usuario}
      `;
      return res.status(429).json({ erro: 'Muitas tentativas. Solicite um novo código.' });
    }

    // Incrementa tentativa
    await sql`
      UPDATE usuarios SET dois_fatores_tentativas = dois_fatores_tentativas + 1
      WHERE id_usuario = ${usuario.id_usuario}
    `;

    // Verifica código e expiração
    if (usuario.dois_fatores_codigo !== codigo)
      return res.status(400).json({ erro: 'Código incorreto.' });
    if (new Date() > new Date(usuario.dois_fatores_expiracao)) {
      await sql`
        UPDATE usuarios SET dois_fatores_codigo = NULL, dois_fatores_expiracao = NULL
        WHERE id_usuario = ${usuario.id_usuario}
      `;
      return res.status(400).json({ erro: 'Código expirado. Solicite um novo.' });
    }

    // Sucesso — confirma o 2FA, limpa o código e emite o token definitivo
    await sql`
      UPDATE usuarios SET
        dois_fatores = TRUE,
        dois_fatores_codigo = NULL,
        dois_fatores_expiracao = NULL,
        dois_fatores_tentativas = 0,
        ultimo_acesso = NOW()
      WHERE id_usuario = ${usuario.id_usuario}
    `;

    const token = jwt.sign(
      { id: usuario.id_usuario, email: usuario.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' },
    );

    const loginEmail = String(payload.login_email || payload.email || '').toLowerCase();
    const is_admin_login = !!usuario.email_admin &&
      loginEmail === String(usuario.email_admin).toLowerCase();

    res.json({
      usuario: {
        id_usuario: usuario.id_usuario,
        nome: usuario.nome,
        email: usuario.email,
        cpf: usuario.cpf ?? '',
        telefone: usuario.telefone ?? '',
        data_nascimento: usuario.data_nascimento ?? null,
        email_verificado: usuario.email_verificado,
        foto_perfil: usuario.foto_perfil ?? '',
        is_admin: usuario.is_admin ?? false,
        email_admin: usuario.email_admin ?? '',
      },
      token,
      is_admin_login,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao verificar código.' });
  }
};

const reenviarCodigo2FA = async (req, res) => {
  const { token_parcial } = req.body;
  if (!token_parcial) return res.status(400).json({ erro: 'Token obrigatório.' });

  try {
    let payload;
    try {
      payload = jwt.verify(token_parcial, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ erro: 'Sessão expirada. Faça login novamente.' });
    }
    if (payload.etapa !== '2fa')
      return res.status(401).json({ erro: 'Token inválido.' });

    const sql = await conectar();
    const [usuario] = await sql`
      SELECT id_usuario, email FROM usuarios WHERE id_usuario = ${payload.id}
    `;
    if (!usuario) return res.status(404).json({ erro: 'Usuário não encontrado.' });

    const codigo = codigoSeguro6();
    const expiracao = new Date(Date.now() + 10 * 60 * 1000);

    await sql`
      UPDATE usuarios SET
        dois_fatores_codigo = ${codigo},
        dois_fatores_expiracao = ${expiracao},
        dois_fatores_tentativas = 0
      WHERE id_usuario = ${usuario.id_usuario}
    `;

    await enviarEmail2FA(usuario.email, codigo).catch((err) => {
      console.error('Falha ao reenviar código 2FA:', err.message);
    });

    res.json({ mensagem: 'Novo código enviado para seu email.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao reenviar código.' });
  }
};

module.exports = {
  signUp,
  signIn,
  verificarEmail,
  reenviarCodigoVerificacao,
  esqueciSenha,
  reenviarRecuperacao,
  redefinirSenha,
  getPerfil,
  atualizarPerfil,
  solicitarTrocaSenha,
  confirmarTrocaSenha,
  solicitarTrocaEmail,
  confirmarTrocaEmail,
  verificar2FA,
  reenviarCodigo2FA,
};
