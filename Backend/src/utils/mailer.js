const { Resend } = require("resend");
const EmailDominio = "Suporte@mercadins.com.br"

const resend = new Resend(process.env.RESEND_API_KEY);

const enviarEmailVerificacao = async (email, codigo, linkVerificacao) => {
  await resend.emails.send({
    from: EmailDominio,
    to: email,
    subject: "Verifique seu e-mail — Mercadins",
    html: `
      <!DOCTYPE html>
      <html>
      <body style="font-family: 'Nunito', Arial, sans-serif; background: #f0f2f7; margin: 0; padding: 40px 20px;">
        <div style="max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 8px 32px rgba(0,0,0,0.1);">
          
          <div style="background: linear-gradient(145deg, #f5c518 0%, #1a3a7a 55%, #0a1f4e 100%); padding: 40px 32px; text-align: center;">
            <h1 style="color: white; font-size: 24px; margin: 0; font-weight: 700;">Verificação de e-mail</h1>
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
                Este código expira em <strong>24 horas</strong>.<br/>
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
            <h1 style="color: white; font-size: 24px; margin: 0; font-weight: 700;">Redefinir senha</h1>
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
                Este código expira em <strong>15 minutos</strong>.<br/>
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

const enviarEmailTrocaEmail = async (email, codigo) => {
  await resend.emails.send({
    from: EmailDominio,
    to: email,
    subject: "Confirme seu novo e-mail — Mercadins",
    html: `
      <!DOCTYPE html>
      <html>
      <body style="font-family: 'Nunito', Arial, sans-serif; background: #f0f2f7; margin: 0; padding: 40px 20px;">
        <div style="max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 8px 32px rgba(0,0,0,0.1);">
          
          <div style="background: linear-gradient(145deg, #f5c518 0%, #1a3a7a 55%, #0a1f4e 100%); padding: 40px 32px; text-align: center;">
            <h1 style="color: white; font-size: 24px; margin: 0; font-weight: 700;">Confirmar novo e-mail</h1>
            <p style="color: rgba(255,255,255,0.8); margin: 8px 0 0; font-size: 14px;">Mercadins — Seu mercado inteligente</p>
          </div>

          <div style="padding: 36px 32px; text-align: center;">
            <p style="color: #0d2a5e; font-size: 16px; font-weight: 600; margin: 0 0 12px;">Olá!</p>
            <p style="color: #8892a4; font-size: 14px; line-height: 1.6; margin: 0 0 28px;">
              Você solicitou a alteração do email da sua conta. Use o código abaixo para confirmar o novo email.
            </p>

            <div style="background: #f0f2f7; border-radius: 12px; padding: 20px; margin: 0 0 28px;">
              <span style="font-size: 36px; font-weight: 800; color: #0d2a5e; letter-spacing: 8px;">${codigo}</span>
            </div>

            <div style="border-top: 1px solid #dde3ef; padding-top: 20px;">
              <p style="color: #8892a4; font-size: 12px; margin: 0; line-height: 1.6;">
                Este código expira em <strong>15 minutos</strong>.<br/>
                Se você não solicitou a alteração, ignore este email — seu email permanece o mesmo.
              </p>
            </div>
          </div>

        </div>
      </body>
      </html>
    `,
  });
};

// ─────────────────────────────────────────────────────────────────────────────
//  Pedidos — e-mails disparados quando o cliente finaliza e a cada mudança de
//  status. O backend envia sem travar a resposta (fire-and-forget com try/catch
//  em quem chama), porque um provedor de e-mail lento ou fora do ar não pode
//  impedir que um pedido seja registrado.
// ─────────────────────────────────────────────────────────────────────────────
const formatarBRL = (v) =>
  Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const corpoPedido = (pedido) => `
  <div style="padding: 32px; text-align: left;">
    <p style="color: #0d2a5e; font-size: 16px; font-weight: 600; margin: 0 0 4px;">Olá, ${pedido.cliente || 'cliente'}!</p>
    <p style="color: #8892a4; font-size: 14px; line-height: 1.6; margin: 0 0 20px;">
      ${pedido.mensagem}
    </p>

    <div style="background: #f0f2f7; border-radius: 12px; padding: 16px 20px; margin: 0 0 16px;">
      <p style="color: #0d2a5e; font-size: 13px; font-weight: 700; margin: 0 0 6px;">Pedido nº ${pedido.numero}</p>
      <p style="color: #4a5568; font-size: 13px; margin: 0 0 4px;">${pedido.mercado}</p>
      <p style="color: #4a5568; font-size: 13px; margin: 0;">${pedido.itens}</p>
    </div>

    <div style="border: 1px solid #dde3ef; border-radius: 12px; padding: 14px 20px; margin: 0 0 20px; font-size: 13px; color: #4a5568;">
      ${pedido.tipoEntrega === 'retirada'
        ? '<p style="margin: 0 0 6px;"><strong>Retirada no balcão</strong></p>'
        : '<p style="margin: 0 0 6px;"><strong>Entrega</strong></p>'}
      ${pedido.agendamento ? `<p style="margin: 0 0 6px;">Quando: ${pedido.agendamento}</p>` : ''}
      <p style="margin: 0 0 4px;">Produtos: ${formatarBRL(pedido.valorTotal)}</p>
      ${Number(pedido.desconto) > 0 ? `<p style="margin: 0 0 4px; color: #1a8e4a;">Cupom ${pedido.cupom}: − ${formatarBRL(pedido.desconto)}</p>` : ''}
      <p style="margin: 0 0 4px;">${pedido.tipoEntrega === 'retirada' ? 'Retirada' : 'Entrega'}: ${Number(pedido.taxa) > 0 ? formatarBRL(pedido.taxa) : 'grátis'}</p>
      <p style="margin: 8px 0 0; font-size: 15px; font-weight: 700; color: #0d2a5e;">Total: ${formatarBRL(pedido.total)}</p>
    </div>

    <div style="border-top: 1px solid #dde3ef; padding-top: 16px;">
      <p style="color: #8892a4; font-size: 12px; margin: 0; line-height: 1.6;">
        Acompanhe o pedido pelo site, na página de ${pedido.mercado}.<br/>
        Este é um e-mail automático do Mercadins.
      </p>
    </div>
  </div>
`;

const enviarEmailPedidoConfirmado = async (email, pedido) => {
  await resend.emails.send({
    from: EmailDominio,
    to: email,
    subject: `Pedido nº ${pedido.numero} recebido — Mercadins`,
    html: `
      <!DOCTYPE html>
      <html>
      <body style="font-family: 'Nunito', Arial, sans-serif; background: #f0f2f7; margin: 0; padding: 40px 20px;">
        <div style="max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 8px 32px rgba(0,0,0,0.1);">
          <div style="background: linear-gradient(145deg, #f5c518 0%, #1a3a7a 55%, #0a1f4e 100%); padding: 36px 32px; text-align: center;">
            <h1 style="color: white; font-size: 22px; margin: 0; font-weight: 700;">Pedido recebido!</h1>
            <p style="color: rgba(255,255,255,0.8); margin: 8px 0 0; font-size: 14px;">Mercadins — Seu mercado inteligente</p>
          </div>
          ${corpoPedido({ ...pedido, mensagem: 'Recebemos o seu pedido e já avisamos a loja. Você receberá um novo e-mail a cada etapa.' })}
        </div>
      </body>
      </html>
    `,
  });
};

const enviarEmailStatusPedido = async (email, pedido, status) => {
  const titulos = {
    pendente:  'Pedido recebido pela loja',
    preparo:   'Seu pedido está sendo preparado',
    caminho:   pedido.tipoEntrega === 'retirada' ? 'Seu pedido está pronto para retirada' : 'Seu pedido saiu para entrega',
    entregue:  'Pedido entregue — obrigado!',
  };
  const mensagens = {
    pendente:  'A loja recebeu o seu pedido e vai começar a prepará-lo em breve.',
    preparo:   'Os itens do seu pedido estão sendo separados e preparados agora.',
    caminho:   pedido.tipoEntrega === 'retirada'
      ? 'Pode buscar o seu pedido no balcão no horário de funcionamento da loja.'
      : 'O entregador já está a caminho do seu endereço.',
    entregue:  'O pedido foi concluído. Se puder, avalie a loja e os produtos no site.',
  };
  const mensagem = mensagens[status] || 'O status do seu pedido foi atualizado.';

  await resend.emails.send({
    from: EmailDominio,
    to: email,
    subject: `${titulos[status] || 'Status do pedido'} — Pedido nº ${pedido.numero}`,
    html: `
      <!DOCTYPE html>
      <html>
      <body style="font-family: 'Nunito', Arial, sans-serif; background: #f0f2f7; margin: 0; padding: 40px 20px;">
        <div style="max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 8px 32px rgba(0,0,0,0.1);">
          <div style="background: linear-gradient(145deg, #f5c518 0%, #1a3a7a 55%, #0a1f4e 100%); padding: 36px 32px; text-align: center;">
            <h1 style="color: white; font-size: 20px; margin: 0; font-weight: 700;">${titulos[status] || 'Status do pedido'}</h1>
            <p style="color: rgba(255,255,255,0.8); margin: 8px 0 0; font-size: 14px;">Mercadins — Seu mercado inteligente</p>
          </div>
          ${corpoPedido({ ...pedido, mensagem })}
        </div>
      </body>
      </html>
    `,
  });
};

module.exports = {
  enviarEmailVerificacao,
  enviarEmailRecuperacao,
  enviarEmailTrocaEmail,
  enviarEmailPedidoConfirmado,
  enviarEmailStatusPedido,
};
