// ─────────────────────────────────────────────────────────────────────────────
//  Notificações por telefone (WhatsApp ou SMS)
//
//  A ideia: o sistema pega o telefone que a pessoa cadastrou e manda um aviso
//  curto ("Cadastro realizado com sucesso", "Seu pedido saiu para entrega"...).
//
//  O envio real depende de um serviço externo. O Mercadins já fala com os
//  principais, bastando preencher as variáveis no Backend/.env:
//
//    WhatsApp Cloud API (Meta)   → WHATSAPP_PROVIDER=meta
//                                  WHATSAPP_TOKEN=...
//                                  WHATSAPP_PHONE_ID=...
//
//    Twilio (WhatsApp ou SMS)    → WHATSAPP_PROVIDER=twilio
//                                  TWILIO_ACCOUNT_SID=...
//                                  TWILIO_AUTH_TOKEN=...
//                                  TWILIO_FROM=whatsapp:+5516...
//                                  TWILIO_CHANNEL=whatsapp | sms
//
//    Z-API (WhatsApp)            → WHATSAPP_PROVIDER=zapi
//                                  ZAPI_URL=https://.../send-text
//                                  ZAPI_TOKEN=...
//
//    Evolution API (WhatsApp)    → WHATSAPP_PROVIDER=evolution
//                                  EVOLUTION_URL=https://...
//                                  EVOLUTION_INSTANCE=...
//                                  EVOLUTION_TOKEN=...
//
//    Webhook próprio             → WHATSAPP_PROVIDER=webhook
//                                  NOTIFICACOES_WEBHOOK_URL=https://...
//                                  NOTIFICACOES_WEBHOOK_TOKEN=...
//
//  Sem nenhum provedor configurado o aviso NÃO se perde: ele é gravado na
//  tabela "notificacoes" com status "sem_provedor" e a tela de Notificações
//  oferece o botão "Abrir no WhatsApp" com a mensagem já pronta.
// ─────────────────────────────────────────────────────────────────────────────

/** Só os dígitos, no formato internacional (55 + DDD + número). */
function telefoneInternacional(telefone) {
  const digitos = String(telefone || '').replace(/\D/g, '');
  if (!digitos) return '';
  if (digitos.startsWith('55') && digitos.length >= 12) return digitos;
  return `55${digitos}`;
}

/** Link "clique para conversar" do WhatsApp com a mensagem pronta. */
function linkWhatsApp(telefone, mensagem) {
  const numero = telefoneInternacional(telefone);
  if (!numero) return '';
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`;
}

function provedorConfigurado() {
  const provedor = String(process.env.WHATSAPP_PROVIDER || '').toLowerCase().trim();
  if (provedor === 'meta') {
    return Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_ID);
  }
  if (provedor === 'twilio') {
    return Boolean(
      process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_FROM
    );
  }
  if (provedor === 'zapi') return Boolean(process.env.ZAPI_URL);
  if (provedor === 'evolution') {
    return Boolean(process.env.EVOLUTION_URL && process.env.EVOLUTION_INSTANCE);
  }
  if (provedor === 'webhook') return Boolean(process.env.NOTIFICACOES_WEBHOOK_URL);
  return false;
}

function nomeDoCanal() {
  const provedor = String(process.env.WHATSAPP_PROVIDER || '').toLowerCase().trim();
  if (provedor === 'twilio' && String(process.env.TWILIO_CHANNEL || '').toLowerCase() === 'sms') {
    return 'sms';
  }
  return 'whatsapp';
}

// Timeout curto no envio: um provedor lento/travado nunca deve atrasar
// o cadastro, o pedido ou a resposta da API. Em 8 s sem resposta, aborta.
const TIMEOUT_ENVIO_MS = 8000;

function opcoesFetch(extra = {}) {
  return { ...extra, signal: AbortSignal.timeout(TIMEOUT_ENVIO_MS) };
}

async function enviarPeloProvedor(telefone, mensagem) {
  const provedor = String(process.env.WHATSAPP_PROVIDER || '').toLowerCase().trim();
  const numero = telefoneInternacional(telefone);

  if (provedor === 'meta') {
    const versao = process.env.WHATSAPP_API_VERSION || 'v20.0';
    const resposta = await fetch(
      `https://graph.facebook.com/${versao}/${process.env.WHATSAPP_PHONE_ID}/messages`,
      opcoesFetch({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: numero,
          type: 'text',
          text: { body: mensagem },
        }),
      })
    );
    if (!resposta.ok) {
      throw new Error(`Meta WhatsApp respondeu ${resposta.status}: ${await resposta.text()}`);
    }
    return;
  }

  if (provedor === 'twilio') {
    const canal = nomeDoCanal();
    const de = process.env.TWILIO_FROM || '';
    const from = canal === 'whatsapp' && !de.startsWith('whatsapp:') ? `whatsapp:${de}` : de;
    const to = canal === 'whatsapp' ? `whatsapp:+${numero}` : `+${numero}`;
    const corpo = new URLSearchParams({ From: from, To: to, Body: mensagem });
    const credenciais = Buffer.from(
      `${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`
    ).toString('base64');
    const resposta = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`,
      opcoesFetch({
        method: 'POST',
        headers: {
          Authorization: `Basic ${credenciais}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: corpo.toString(),
      })
    );
    if (!resposta.ok) {
      throw new Error(`Twilio respondeu ${resposta.status}: ${await resposta.text()}`);
    }
    return;
  }

  if (provedor === 'zapi') {
    const resposta = await fetch(process.env.ZAPI_URL, opcoesFetch({
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.ZAPI_TOKEN ? { 'x-api-key': process.env.ZAPI_TOKEN } : {}),
      },
      body: JSON.stringify({ phone: numero, message: mensagem }),
    }));
    if (!resposta.ok) {
      throw new Error(`Z-API respondeu ${resposta.status}: ${await resposta.text()}`);
    }
    return;
  }

  if (provedor === 'evolution') {
    const base = String(process.env.EVOLUTION_URL).replace(/\/+$/, '');
    const resposta = await fetch(
      `${base}/message/sendText/${process.env.EVOLUTION_INSTANCE}`,
      opcoesFetch({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(process.env.EVOLUTION_TOKEN ? { apikey: process.env.EVOLUTION_TOKEN } : {}),
        },
        body: JSON.stringify({ number: numero, text: mensagem }),
      })
    );
    if (!resposta.ok) {
      throw new Error(`Evolution API respondeu ${resposta.status}: ${await resposta.text()}`);
    }
    return;
  }

  if (provedor === 'webhook') {
    const resposta = await fetch(process.env.NOTIFICACOES_WEBHOOK_URL, opcoesFetch({
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.NOTIFICACOES_WEBHOOK_TOKEN
          ? { Authorization: `Bearer ${process.env.NOTIFICACOES_WEBHOOK_TOKEN}` }
          : {}),
      },
      body: JSON.stringify({ telefone: numero, mensagem, canal: nomeDoCanal() }),
    }));
    if (!resposta.ok) {
      throw new Error(`Webhook respondeu ${resposta.status}: ${await resposta.text()}`);
    }
    return;
  }

  throw new Error('Nenhum provedor de notificação configurado.');
}

/**
 * Grava o aviso no histórico e, quando há provedor configurado, envia na hora.
 *
 * @param {Function} sql        conexão do banco (retorno de conectar())
 * @param {Object}   dados      { id_usuario, id_mercado, telefone, tipo, titulo, mensagem }
 * @returns {Promise<Object|null>} registro salvo (com linkWhatsApp)
 */
async function enviarNotificacaoTelefone(sql, dados = {}) {
  const {
    id_usuario = null,
    id_mercado = null,
    telefone = '',
    tipo = 'aviso',
    titulo = '',
    mensagem = '',
  } = dados;

  if (!telefone || !mensagem) return null;

  const canal = nomeDoCanal();
  let status = 'registrada';
  let erro = '';
  let enviadoEm = null;

  if (provedorConfigurado()) {
    try {
      await enviarPeloProvedor(telefone, mensagem);
      status = 'enviada';
      enviadoEm = new Date();
    } catch (falha) {
      status = 'erro';
      erro = String(falha?.message || falha).slice(0, 500);
      console.error(`Notificação (${tipo}) não enviada:`, erro);
    }
  } else {
    status = 'sem_provedor';
  }

  try {
    const [registro] = await sql`
      INSERT INTO notificacoes
        (id_usuario, id_mercado, telefone, canal, tipo, titulo, mensagem, status, erro, enviado_em)
      VALUES
        (${id_usuario}, ${id_mercado}, ${telefone}, ${canal}, ${tipo}, ${titulo}, ${mensagem}, ${status}, ${erro}, ${enviadoEm})
      RETURNING *
    `;
    return { ...registro, linkWhatsApp: linkWhatsApp(telefone, mensagem) };
  } catch (falha) {
    // Nunca deixa uma falha de aviso derrubar a ação principal (cadastro,
    // pedido etc.). Só registra no log do servidor.
    console.error('Não foi possível gravar a notificação:', falha.message);
    return null;
  }
}

module.exports = {
  enviarNotificacaoTelefone,
  linkWhatsApp,
  provedorConfigurado,
  nomeDoCanal,
  telefoneInternacional,
};
