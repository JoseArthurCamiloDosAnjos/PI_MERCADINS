const { Resend } = require("resend");
const EmailDominio = "Suporte@mercadins.com.br"

const resend = new Resend(process.env.RESEND_API_KEY);

const enviarEmailVerificacao = async (email, codigo, linkVerificacao) => {
  await resend.emails.send({
    from: EmailDominio,
    to: email,
    subject: "Verifique seu email — Mercadins",
    html: `
      <!DOCTYPE html>
      <html>
      <body style="font-family: 'Nunito', Arial, sans-serif; background: #f0f2f7; margin: 0; padding: 40px 20px;">
        <div style="max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 8px 32px rgba(0,0,0,0.1);">
          
          <div style="background: linear-gradient(145deg, #f5c518 0%, #1a3a7a 55%, #0a1f4e 100%); padding: 40px 32px; text-align: center;">
            <h1 style="color: white; font-size: 24px; margin: 0; font-weight: 700;">📩 Verificação de Email</h1>
            <p style="color: rgba(255,255,255,0.8); margin: 8px 0 0; font-size: 14px;">Mercadins — Seu mercado inteligente</p>
          </div>

          <div style="padding: 36px 32px; text-align: center;">
            <p style="color: #0d2a5e; font-size: 16px; font-weight: 600; margin: 0 0 12px;">Olá!</p>
            <p style="color: #8892a4; font-size: 14px; line-height: 1.6; margin: 0 0 28px;">
              Use o código abaixo para verificar seu email e concluir o cadastro:
            </p>

            <div style="background: #f0f2f7; border-radius: 12px; padding: 20px; margin: 0 0 28px;">
              <span style="font-size: 36px; font-weight: 800; color: #0d2a5e; letter-spacing: 8px;">${codigo}</span>
            </div>

            ${linkVerificacao ? `
            <a href="${linkVerificacao}" style="display: inline-block; background: #0d2a5e; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 10px; font-weight: 700; font-size: 15px; margin-bottom: 28px;">
              Verificar meu email
            </a>
            ` : ''}

            <div style="border-top: 1px solid #dde3ef; padding-top: 20px;">
              <p style="color: #8892a4; font-size: 12px; margin: 0; line-height: 1.6;">
                ⏱ Este código expira em <strong>24 horas</strong>.<br/>
                ${linkVerificacao ? `Você também pode <a href="${linkVerificacao}" style="color: #0d2a5e; font-weight: 600;">clicando aqui</a>.<br/>` : ''}
                Se você não solicitou o cadastro, ignore este email.
              </p>
            </div>
          </div>

        </div>
      </body>
      </html>
    `,
  });
};



const enviarEmailRecuperacao = async (email, codigo) => {
  await resend.emails.send({
    from: EmailDominio,
    to: email,
    subject: "Código de recuperação de senha — Mercadins",
    html: `
      <!DOCTYPE html>
      <html>
      <body style="font-family: 'Nunito', Arial, sans-serif; background: #f0f2f7; margin: 0; padding: 40px 20px;">
        <div style="max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 8px 32px rgba(0,0,0,0.1);">
          
          <div style="background: linear-gradient(145deg, #f5c518 0%, #1a3a7a 55%, #0a1f4e 100%); padding: 40px 32px; text-align: center;">
            <h1 style="color: white; font-size: 24px; margin: 0; font-weight: 700;">🔒 Redefinir Senha</h1>
            <p style="color: rgba(255,255,255,0.8); margin: 8px 0 0; font-size: 14px;">Mercadins — Seu mercado inteligente</p>
          </div>

          <div style="padding: 36px 32px; text-align: center;">
            <p style="color: #0d2a5e; font-size: 16px; font-weight: 600; margin: 0 0 12px;">Olá!</p>
            <p style="color: #8892a4; font-size: 14px; line-height: 1.6; margin: 0 0 28px;">
              Recebemos uma solicitação para redefinir a senha da sua conta. Use o código abaixo para criar uma nova senha.
            </p>

            <div style="background: #f0f2f7; border-radius: 12px; padding: 20px; margin: 0 0 28px;">
              <span style="font-size: 36px; font-weight: 800; color: #0d2a5e; letter-spacing: 8px;">${codigo}</span>
            </div>

            <div style="border-top: 1px solid #dde3ef; padding-top: 20px;">
              <p style="color: #8892a4; font-size: 12px; margin: 0; line-height: 1.6;">
                ⏱ Este código expira em <strong>15 minutos</strong>.<br/>
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
