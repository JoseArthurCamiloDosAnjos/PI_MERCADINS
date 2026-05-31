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



const enviarEmailRecuperacao = async (email, token) => {
  const link = `${process.env.BASE_URL}/redefinir-senha?token=${token}`;

  await resend.emails.send({
    from: EmailDominio,
    to: email,
    subject: "Recuperação de senha — Mercadins",
    html: `
      <!DOCTYPE html>
      <html>
      <body style="font-family: 'Nunito', Arial, sans-serif; background: #f0f2f7; margin: 0; padding: 40px 20px;">
        <div style="max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 8px 32px rgba(0,0,0,0.1);">
          
          <div style="background: linear-gradient(145deg, #f5c518 0%, #1a3a7a 55%, #0a1f4e 100%); padding: 40px 32px; text-align: center;">
            <h1 style="color: white; font-size: 24px; margin: 0; font-weight: 700;">🔒 Redefinir Senha</h1>
            <p style="color: rgba(255,255,255,0.8); margin: 8px 0 0; font-size: 14px;">Mercadins — Seu mercado inteligente</p>
          </div>

          <div style="padding: 36px 32px;">
            <p style="color: #0d2a5e; font-size: 16px; font-weight: 600; margin: 0 0 12px;">Olá!</p>
            <p style="color: #8892a4; font-size: 14px; line-height: 1.6; margin: 0 0 28px;">
              Recebemos uma solicitação para redefinir a senha da sua conta. Clique no botão abaixo para criar uma nova senha.
            </p>

            <div style="text-align: center; margin: 0 0 28px;">
              <a href="${link}" style="
                display: inline-block;
                background: #0d2a5e;
                color: #ffffff;
                text-decoration: none;
                padding: 14px 32px;
                border-radius: 12px;
                font-size: 15px;
                font-weight: 700;
                letter-spacing: 0.3px;
              ">Redefinir minha senha</a>
            </div>

            <p style="color: #8892a4; font-size: 13px; line-height: 1.6; margin: 0 0 8px;">
              Se o botão não funcionar, copie e cole o link abaixo no seu navegador:
            </p>
            <p style="background: #f0f2f7; border-radius: 8px; padding: 10px 14px; font-size: 12px; color: #1a3a7a; word-break: break-all; margin: 0 0 24px;">${link}</p>

            <div style="border-top: 1px solid #dde3ef; padding-top: 20px;">
              <p style="color: #8892a4; font-size: 12px; margin: 0; line-height: 1.6;">
                ⏱ Este link expira em <strong>1 hora</strong>.<br/>
                Se você não solicitou a redefinição, ignore este email — sua senha permanece a mesma.
              </p>
            </div>
          </div>

        </div>
      </body>
      </html>
    `,
  });
};

module.exports = {
  
  enviarEmailVerificacao,
  enviarEmailRecuperacao
};
