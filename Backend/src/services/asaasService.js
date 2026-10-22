require('dotenv').config()

const isProduction = process.env.NODE_ENV === 'production' || !!process.env.RENDER

const BASE_URL = isProduction
  ? process.env.Assas_API_URL_Producao
  : process.env.Assas_API_URL_Sandbox

// Catálogo de planos — o preço é SEMPRE definido aqui, nunca pelo cliente.
// Anual = mensal com 20% de desconto (mesmo cálculo exibido no frontend: floor(mensal * 0.8) * 12).
const PLANOS = {
  basico: {
    nome: 'Básico',
    mensal: 79.0,
    anual: Math.floor(79 * 0.8) * 12, // 756.00
  },
  profissional: {
    nome: 'Profissional',
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
async function criarAssinatura({ customerId, valor, ciclo, descricao }) {
  // Vencimento em 3 dias (margem segura para boleto)
  const vencimento = new Date()
  vencimento.setDate(vencimento.getDate() + 3)
  const nextDueDate = vencimento.toISOString().slice(0, 10)

  return chamarApi('/v3/subscriptions', {
    method: 'POST',
    body: {
      customer: customerId,
      billingType: 'UNDEFINED',
      value: valor,
      cycle: ciclo === 'ANUAL' ? 'YEARLY' : 'MONTHLY',
      nextDueDate,
      description: descricao || 'Assinatura Mercadins',
    },
  })
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

module.exports = {
  obterPlano,
  criarCustomer,
  criarAssinatura,
  buscarUrlPagamento,
  cancelarAssinatura,
}
