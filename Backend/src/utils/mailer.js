const { Resend } = require("resend");
const EmailDominio = "onboarding@resend.dev"

const resend = new Resend(process.env.RESEND_API_KEY);

const enviarEmailVerificacao = async (email, token) => {
  const link = `${process.env.BASE_URL}/api/auth/verificar-email?token=${token}`;
  
  await resend.emails.send({
    from: EmailDominio,
    to: email,
    subject: "Verifique seu email",
    html: `
      <h2>Bem-vindo!</h2>
      <p>Clique no link abaixo para verificar seu email:</p>
      <a href="${link}">${link}</a>
      <p>Este link expira em 24 horas.</p>
    `,
  });
};



const enviarEmailRecuperacao =
  async (email, token) => {

    const link =
      `http://localhost:5173/redefinir-senha?token=${token}`;

    await resend.emails.send({
      from: EmailDominio,

      to: email,

      subject: "Recuperação de senha",

      html: `
        <h2>Recuperação de senha</h2>

        <p>
          Clique no botão abaixo
          para redefinir sua senha:
        </p>

        <a href="${link}">
          Redefinir senha
        </a>

        <p>
          Este link expira em 1 hora.
        </p>
      `,
    });
};

module.exports = {
  
  enviarEmailVerificacao,
  enviarEmailRecuperacao
};
