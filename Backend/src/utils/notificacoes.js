// ─────────────────────────────────────────────────────────────────────────────
//  Notificações por e-mail
//
//  Toda notificação do sistema é gravada na tabela "notificacoes" (canal
//  'email') e, quando faz sentido, um e-mail é disparado na hora via Resend
//  (mesmo serviço dos e-mails de verificação/pedido).
//
//  Regra de ouro: **um evento = um e-mail**. Quando o fluxo já dispara um
//  e-mail próprio (verificação de cadastro, pedido confirmado, status do
//  pedido...), a notificação é registrada apenas no histórico com
//  `enviarEmail: false` — assim a pessoa não recebe duas mensagens para a
//  mesma coisa.
//
//  O envio é fire-and-forget: uma falha de e-mail nunca derruba o cadastro,
//  o pedido ou a criação do mercado. A falha fica registrada na própria
//  notificação (status 'erro') e no log do servidor.
// ─────────────────────────────────────────────────────────────────────────────

const { enviarEmailNotificacao } = require('./mailer');

/**
 * Grava a notificação no histórico e, opcionalmente, dispara o e-mail.
 *
 * @param {Function} sql   conexão do banco (retorno de conectar())
 * @param {Object}   dados {
 *   id_usuario, id_mercado, email, tipo, titulo, mensagem,
 *   enviarEmail = true   // false quando o evento já tem e-mail próprio
 * }
 * @returns {Promise<Object|null>} registro salvo
 */
async function enviarNotificacao(sql, dados = {}) {
  const {
    id_usuario = null,
    id_mercado = null,
    email: emailInformado = '',
    tipo = 'aviso',
    titulo = '',
    mensagem = '',
    enviarEmail = true,
  } = dados;

  if (!mensagem) return null;

  let email = String(emailInformado || '').trim();
  if (!email && id_usuario) {
    try {
      const [usuario] = await sql`
        SELECT email FROM usuarios WHERE id_usuario = ${id_usuario}
      `;
      email = usuario?.email || '';
    } catch (falha) {
      console.error('Não foi possível consultar o e-mail da notificação:', falha.message);
    }
  }

  let status = 'registrada';
  let erro = '';
  let enviadoEm = null;

  if (enviarEmail && email) {
    try {
      await enviarEmailNotificacao(email, titulo, mensagem);
      status = 'enviada';
      enviadoEm = new Date();
    } catch (falha) {
      status = 'erro';
      erro = String(falha?.message || falha).slice(0, 500);
      console.error(`Notificação (${tipo}) não enviada:`, erro);
    }
  }

  try {
    const [registro] = await sql`
      INSERT INTO notificacoes
        (id_usuario, id_mercado, canal, tipo, titulo, mensagem, status, erro, enviado_em)
      VALUES
        (${id_usuario}, ${id_mercado}, 'email', ${tipo}, ${titulo}, ${mensagem}, ${status}, ${erro}, ${enviadoEm})
      RETURNING *
    `;
    return registro;
  } catch (falha) {
    // Nunca deixa uma falha de aviso derrubar a ação principal (cadastro,
    // pedido etc.). Só registra no log do servidor.
    console.error('Não foi possível gravar a notificação:', falha.message);
    return null;
  }
}

module.exports = { enviarNotificacao };
