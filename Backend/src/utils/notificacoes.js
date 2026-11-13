//  Notificações por e-mail

const { enviarEmailNotificacao } = require('./mailer');

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
    console.error('Não foi possível gravar a notificação:', falha.message);
    return null;
  }
}

module.exports = { enviarNotificacao };
