const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

const enviarEmailVerificacao = async (email, token) => {
  const link = `${process.env.BASE_URL}/auth/verificar-email?token=${token}`;

  await resend.emails.send({
    from: 'onboarding@resend.dev',
    to: email,
    subject: 'Verifique seu email',
    html: `
      <h2>Bem-vindo!</h2>
      <p>Clique no link abaixo para verificar seu email:</p>
      <a href="${link}">${link}</a>
      <p>Este link expira em 24 horas.</p>
    `,
  });
};

module.exports = { enviarEmailVerificacao };