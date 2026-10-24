require('dotenv').config()

const isProduction = process.env.NODE_ENV === 'production' || !!process.env.RENDER

const BASE_URL = isProduction
  ? process.env.Assas_API_URL_Producao
  : process.env.Assas_API_URL_Sandbox

// Catálogo de planos — o preço é SEMPRE definido aqui, nunca pelo cliente.
// Anual = mensal com 20% de desconto (mesmo cálculo exibido no frontend: floor(mensal * 0.8) * 12).
// Nomes comerciais iguais aos do frontend (Frontend/src/pages/MercadinsPromo/planos.ts);
// as chaves ('basico' etc.) são as gravadas no banco e não mudam.
const PLANOS = {
  basico: {
    nome: 'Essencial',
    mensal: 79.0,
    anual: Math.floor(79 * 0.8) * 12, // 756.00
  },
  profissional: {
    nome: 'Plus',
    mensal: 149.0,
    anual: Math.floor(149 * 0.8) * 12, // 1428.00
  },
}

function obterPlano(codigoPlano, ciclo) {
  const plano = PLANOS[codigoPlano]
  if (!plano) return null
  const valor = ciclo === 'ANUAL' ? plano.anual : plano.mensal
  return { codigo: codigoPlano, nome: plano.nome, ciclo, valor }
}

async function chamarApi(path, { method = 'GET', body } = {}) {
  if (!process.env.Assas_API_KEY) {
    throw new Error('Chave da API do Asaas não configurada (Assas_API_KEY).')
  }
  if (!BASE_URL) {
    throw new Error('URL da API do Asaas não configurada.')
  }

  const resposta = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      access_token: process.env.Assas_API_KEY,
    },
    ...(body !== undefined && { body: JSON.stringify(body) }),
  })

  const dados = await resposta.json().catch(() => null)

  if (!resposta.ok) {
    const detalhes = dados?.errors?.map(e => e.description).filter(Boolean).join('; ')
    throw new Error(detalhes || `Erro na API do Asaas (${resposta.status}).`)
  }

  return dados
}

// POST /v3/customers
async function criarCustomer({ nome, email, cpfCnpj, mobilePhone }) {
  const body = { name: nome, email }
  if (cpfCnpj) body.cpfCnpj = cpfCnpj
  if (mobilePhone) body.mobilePhone = mobilePhone
  return chamarApi('/v3/customers', { method: 'POST', body })
}

// POST /v3/subscriptions — billingType UNDEFINED deixa o cliente escolher PIX/boleto/cartão no checkout
async function criarAssinatura({ customerId, valor, ciclo, descricao, redirectUrl }) {
  // Vencimento em 3 dias (margem segura para boleto)
  const vencimento = new Date()
  vencimento.setDate(vencimento.getDate() + 3)
  const nextDueDate = vencimento.toISOString().slice(0, 10)

  const corpo = {
    customer: customerId,
    billingType: 'UNDEFINED',
    value: valor,
    cycle: ciclo === 'ANUAL' ? 'YEARLY' : 'MONTHLY',
    nextDueDate,
    description: descricao || 'Assinatura Mercadins',
  }
  // Volta automática para o site após o pagamento (docs: redirection-after-payment)
  if (redirectUrl) {
    corpo.callback = { successUrl: redirectUrl, autoRedirect: true }
  }

  try {
    return await chamarApi('/v3/subscriptions', { method: 'POST', body: corpo })
  } catch (erro) {
    // Conta sem domínio cadastrado não aceita o callback — cria sem redirect
    // (o frontend oferece o botão manual "Ir para o pagamento" como alternativa)
    if (corpo.callback && /dom[ií]nio/i.test(erro.message)) {
      delete corpo.callback
      return chamarApi('/v3/subscriptions', { method: 'POST', body: corpo })
    }
    throw erro
  }
}

// GET /v3/payments?subscription=... — retorna o link da primeira cobrança (checkout)
async function buscarUrlPagamento(subscriptionId) {
  const dados = await chamarApi(`/v3/payments?subscription=${subscriptionId}&limit=1`)
  const pagamento = dados?.data?.[0]
  return pagamento?.invoiceUrl || null
}

// DELETE /v3/subscriptions/{id}
async function cancelarAssinatura(subscriptionId) {
  return chamarApi(`/v3/subscriptions/${subscriptionId}`, { method: 'DELETE' })
}

// ─────────────────────────────────────────────────────────────────────────────
//  Pagamento de PEDIDO (compra de produtos, não assinatura)
//  externalReference = "pedido:<id>" → é o que faz o webhook avisar o sistema
//  de que aquele pedido específico foi pago.
// ─────────────────────────────────────────────────────────────────────────────

// Vencimento da cobrança de pedido: amanhã (Pix costuma pagar em segundos;
// cartão em até 1 dia é folga suficiente sem prender estoque tempo demais)
function vencimentoPedido() {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().slice(0, 10)
}

// POST /v3/payments (billingType PIX) — devolve QR code + código copia e cola
async function criarPagamentoPedidoPix({ customerId, valor, descricao, externalReference }) {
  const pagamento = await chamarApi('/v3/payments', {
    method: 'POST',
    body: {
      customer: customerId,
      billingType: 'PIX',
      value: valor,
      description: descricao,
      dueDate: vencimentoPedido(),
      externalReference,
    },
  })
  // QR vem embutido em pirBank (encodedImage em base64 + payload copia e cola)
  const pix = pagamento?.pirBank?.[0] || pagamento?.pixTransaction?.[0] || null
  return {
    id: pagamento.id,
    status: pagamento.status,
    vencimento: pagamento.dueDate || null,
    qrCodeBase64: pix?.encodedImage || '',
    copiaEcola: pix?.payload || '',
    urlPagamento: pagamento.invoiceUrl || '',
  }
}

// POST /v3/payments (billingType CREDIT_CARD) — monta o link de pagamento
// (o cartão é digitado na página segura do Asaas; o número nunca passa por aqui)
async function criarPagamentoPedidoCartao({ customerId, valor, descricao, externalReference, redirectUrl }) {
  const corpo = {
    customer: customerId,
    billingType: 'CREDIT_CARD',
    value: valor,
    description: descricao,
    dueDate: vencimentoPedido(),
    externalReference,
  }
  // Criação sem dados de cartão gera o link de pagamento (invoiceUrl) usado
  // pelo checkout do Asaas; o redirect volta o cliente para o pedido
  if (redirectUrl) {
    corpo.callback = { successUrl: redirectUrl, autoRedirect: true }
  }

  try {
    const pagamento = await chamarApi('/v3/payments', { method: 'POST', body: corpo })
    return {
      id: pagamento.id,
      status: pagamento.status,
      vencimento: pagamento.dueDate || null,
      urlPagamento: pagamento.invoiceUrl || '',
    }
  } catch (erro) {
    // Conta sem domínio cadastrado não aceita o callback — cria sem redirect
    if (corpo.callback && /dom[ií]nio/i.test(erro.message)) {
      delete corpo.callback
      const pagamento = await chamarApi('/v3/payments', { method: 'POST', body: corpo })
      return {
        id: pagamento.id,
        status: pagamento.status,
        vencimento: pagamento.dueDate || null,
        urlPagamento: pagamento.invoiceUrl || '',
      }
    }
    throw erro
  }
}

// GET /v3/payments/{id} — usado pelo webhook para confirmar o pagamento
// (nunca confiar só no corpo da mensagem: o status é conferido na fonte)
async function buscarPagamento(paymentId) {
  return chamarApi(`/v3/payments/${paymentId}`)
}

// GET /v3/payments/{id}/pixQrCode — recarrega o QR de um Pix já criado
// (usado pela tela de acompanhamento quando o cliente recarrega a página)
async function buscarQrPix(paymentId) {
  return chamarApi(`/v3/payments/${paymentId}/pixQrCode`)
}

// DELETE /v3/payments/{id} — cancela uma cobrança ainda não paga
// (usado quando o cliente cancela um pedido que aguardava Pix/cartão)
async function cancelarPagamento(paymentId) {
  return chamarApi(`/v3/payments/${paymentId}`, { method: 'DELETE' })
}

module.exports = {
  obterPlano,
  criarCustomer,
  criarAssinatura,
  buscarUrlPagamento,
  cancelarAssinatura,
  criarPagamentoPedidoPix,
  criarPagamentoPedidoCartao,
  buscarPagamento,
  buscarQrPix,
  cancelarPagamento,
}
