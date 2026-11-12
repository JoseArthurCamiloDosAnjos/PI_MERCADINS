require('dotenv').config()

const isProduction = process.env.NODE_ENV === 'production' || !!process.env.RENDER

// ── Qual ambiente usar? ──────────────────────────────────────────────────────
// A chave diz a verdade: `$aact_prod_` só vale em produção e `$aact_hmlg_`
// (homologação) só no sandbox — usar a URL errada dá 401
// "invalid_environment" ("a chave não pertence a este ambiente"). Por isso a
// URL é escolhida PELA CHAVE, com duas exceções:
//   • ASAAS_AMBIENTE=producao|sandbox força o ambiente (ex.: testar a API);
//   • sem chave, cai no comportamento antigo (NODE_ENV/RENDER).
const chaveApi = (process.env.Assas_API_KEY || '').trim()
const forcarAmbiente = String(process.env.ASAAS_AMBIENTE || '').trim().toLowerCase()

function escolherAmbiente() {
  if (forcarAmbiente === 'producao' || forcarAmbiente === 'sandbox') return forcarAmbiente
  if (chaveApi.startsWith('$aact_prod_')) return 'producao'
  if (chaveApi.startsWith('$aact_hmlg_')) return 'sandbox'
  return isProduction ? 'producao' : 'sandbox'
}

const AMBIENTE = escolherAmbiente()

const BASE_URL = AMBIENTE === 'producao'
  ? process.env.Assas_API_URL_Producao
  : process.env.Assas_API_URL_Sandbox

// Falta de variável é o erro mais comum em produção (Render) — avisa já na
// subida, nos logs, para não virar "502 genérico" depois
if (!BASE_URL) {
  console.error(
    `asaasService: URL da API não configurada (esperando ${AMBIENTE === 'producao' ? 'Assas_API_URL_Producao' : 'Assas_API_URL_Sandbox'})`
  )
}

if (chaveApi) {
  const chaveEhProd = chaveApi.startsWith('$aact_prod_')
  if (AMBIENTE === 'sandbox' && chaveEhProd) {
    console.error('asaasService: chave de PRODUÇÃO com ambiente SANDBOX — as chamadas vão falhar com 401 (invalid_environment).')
  }
  if (AMBIENTE === 'producao' && chaveApi.startsWith('$aact_hmlg_')) {
    console.error('asaasService: chave de SANDBOX com ambiente PRODUÇÃO — as chamadas vão falhar com 401 (invalid_environment).')
  }
}

console.log(`asaasService: ambiente Asaas = ${AMBIENTE} (${BASE_URL || 'URL não configurada'})`) 

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
    // Motivo real do Asaas: errors[] (padrão), message ou error. O 403 de
    // permissão de chave vem sem errors e virava "Erro na API do Asaas (403)"
    // sem dizer nada — loga o corpo bruto para diagnóstico também.
    const detalhes = Array.isArray(dados?.errors)
      ? dados.errors.map(e => e?.description || e?.message || e?.code).filter(Boolean).join('; ')
      : (typeof dados?.message === 'string' && dados.message) ||
        (typeof dados?.error === 'string' && dados.error) ||
        (typeof dados === 'string' ? dados : '')
    console.error(
      `asaasService: ${resposta.status} ${method} ${path} →`,
      JSON.stringify(dados)?.slice(0, 800)
    )
    throw new Error(detalhes || `Erro na API do Asaas (${resposta.status}).`)
  }

  return dados
}

// POST /v3/accounts — cria uma SUBCONTA vinculada à conta-pai (a plataforma).
// O split usa o walletId devolvido; a apiKey da resposta não é gravada aqui
// (os repasses são feitos pela conta raiz, que já é quem emite a cobrança).
// Pré-requisitos: conta-pai precisa ser Pessoa Jurídica (CNPJ), o CEP precisa
// ser válido (o Asaas retorna 400 se não localizar) e companyType é exigido
// pela API para CNPJ (MEI/LIMITED/INDIVIDUAL/ASSOCIATION) mesmo não constando
// no `required` do OpenAPI. Renda mensal: o cadastro não coleta faturamento —
// usa um piso declarado, ajustável pelo dono no painel do Asaas depois.
async function criarSubconta({ nome, email, cpfCnpj, mobilePhone, endereco, bairro, cep, companyType }) {
  const cepNum = String(cep || '').replace(/\D/g, '')
  const postalCode = cepNum.length === 8 ? `${cepNum.slice(0, 5)}-${cepNum.slice(5)}` : cepNum
  return chamarApi('/v3/accounts', {
    method: 'POST',
    body: {
      name: nome,
      email,
      cpfCnpj,
      mobilePhone,
      incomeValue: 1000,
      companyType: companyType || 'LIMITED',
      address: endereco,
      addressNumber: 'S/N',
      province: bairro,
      postalCode,
    },
  })
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

// GET /v3/payments?subscription=... — cobranças da assinatura
// (order=DESC: a mais recente primeiro)
async function buscarPagamentosAssinatura(subscriptionId, limite = 10) {
  const dados = await chamarApi(
    `/v3/payments?subscription=${subscriptionId}&limit=${limite}&order=DESC`
  )
  return Array.isArray(dados?.data) ? dados.data : []
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

// ─────────────────────────────────────────────────────────────────────────────
//  Split de pagamento (repasse automático ao vendedor)
//  O percentual é calculado sobre o LÍQUIDO (netValue, após a taxa do Asaas).
//  100% pro lojista: a plataforma não cobra comissão nas vendas — a receita
//  dela é só das assinaturas de plano. O saldo que não for direcionado (0%)
//  permanece na conta emissora.
// ─────────────────────────────────────────────────────────────────────────────
function montarSplitVendedor(walletId, externalReference) {
  if (!walletId) return null;
  const split = {
    walletId: String(walletId).trim(),
    percentualValue: 100,
  };
  if (externalReference) split.externalReference = String(externalReference).slice(0, 100);
  return [split];
}

// ─────────────────────────────────────────────────────────────────────────────
//  QR do Pix
//  • logo após criar a cobrança o /pixQrCode ainda pode responder 404/vazio
//    ("QR ainda não gerado") — tenta de novo antes de desistir;
//  • erro de CHAVE (401/403) não adianta repetir — falha na hora;
//  • o encodedImage às vezes volta com o prefixo "data:image/png;base64,";
//    a tela monta esse prefixo sozinha, então aqui ele é removido.
// ─────────────────────────────────────────────────────────────────────────────
function normalizarQr(qr) {
  const b64 = String(qr?.encodedImage || '')
    .replace(/^data:image\/[a-z+]+;base64,/i, '')
  return { qrCodeBase64: b64, copiaEcola: qr?.payload || '' }
}

function erroDeChave(erro) {
  return /401|403|access_token|chave|api key|autoriza/i.test(String(erro?.message || ''))
}

async function buscarQrPixComRetry(paymentId, tentativas = 3) {
  let ultimoErro = null
  for (let t = 0; t < tentativas; t++) {
    if (t > 0) await new Promise(r => setTimeout(r, 700))
    try {
      const qr = await chamarApi(`/v3/payments/${paymentId}/pixQrCode`)
      if (qr?.encodedImage || qr?.payload) return qr
      ultimoErro = new Error('QR code ainda não gerado pelo Asaas.')
    } catch (erroQr) {
      ultimoErro = erroQr
      if (erroDeChave(erroQr)) break
    }
  }
  throw ultimoErro
}

// POST /v3/payments (billingType PIX) — devolve QR code + código copia e cola
async function criarPagamentoPedidoPix({ customerId, valor, descricao, externalReference, splits }) {
  const corpo = {
    customer: customerId,
    billingType: 'PIX',
    value: valor,
    description: descricao,
    dueDate: vencimentoPedido(),
    externalReference,
  };
  // Split: o Asaas transfere o valor líquido para a carteira do vendedor
  // assim que o Pix cai (docs.asaas.com/docs/split-de-pagamentos)
  if (Array.isArray(splits) && splits.length > 0) corpo.splits = splits;

  const pagamento = await chamarApi('/v3/payments', {
    method: 'POST',
    body: corpo,
  })
  // QR não vem junto na criação: o Asaas só entrega em /pixQrCode (e pode
  // demorar alguns ms — por isso a versão com retry)
  let qr = null
  try {
    qr = await buscarQrPixComRetry(pagamento.id)
  } catch (erroQr) {
    console.error('asaasService: não foi possível buscar o QR do Pix:', erroQr.message)
  }
  // Compatibilidade: se algum dia voltar a vir embutido, usa o que vier
  const embutido = pagamento?.pixTransaction?.[0] || pagamento?.pirBank?.[0] || null
  const fonte = qr?.encodedImage || qr?.payload ? qr : embutido
  const { qrCodeBase64, copiaEcola } = normalizarQr(fonte)
  return {
    id: pagamento.id,
    status: pagamento.status,
    vencimento: pagamento.dueDate || null,
    qrCodeBase64,
    copiaEcola,
    urlPagamento: pagamento.invoiceUrl || '',
    // Splits criados junto da cobrança (ids p/ conciliar o repasse)
    split: Array.isArray(pagamento.split) ? pagamento.split : [],
  }
}

// POST /v3/payments (billingType CREDIT_CARD) — monta o link de pagamento
// (o cartão é digitado na página segura do Asaas; o número nunca passa por aqui)
async function criarPagamentoPedidoCartao({ customerId, valor, descricao, externalReference, redirectUrl, splits }) {
  const corpo = {
    customer: customerId,
    billingType: 'CREDIT_CARD',
    value: valor,
    description: descricao,
    dueDate: vencimentoPedido(),
    externalReference,
  }
  if (Array.isArray(splits) && splits.length > 0) corpo.splits = splits
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
      split: Array.isArray(pagamento.split) ? pagamento.split : [],
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
        split: Array.isArray(pagamento.split) ? pagamento.split : [],
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
// (usado pela tela de acompanhamento quando o cliente recarga a página).
// Mesmo retry do momento da criação: o QR pode ainda não estar pronto.
async function buscarQrPix(paymentId) {
  const qr = await buscarQrPixComRetry(paymentId, 2)
  const { qrCodeBase64, copiaEcola } = normalizarQr(qr)
  return { encodedImage: qrCodeBase64, payload: copiaEcola }
}

// DELETE /v3/payments/{id} — cancela uma cobrança ainda não paga
// (usado quando o cliente cancela um pedido que aguardava Pix/cartão)
async function cancelarPagamento(paymentId) {
  return chamarApi(`/v3/payments/${paymentId}`, { method: 'DELETE' })
}

// POST /v3/payments/{id}/refund — estorno total de pagamento já confirmado.
// Só funciona para cartão; Pix não é estornável pela API (a falha é capturada
// pelo chamador e vira alerta para estorno manual no painel do Asaas).
async function estornarPagamento(paymentId) {
  return chamarApi(`/v3/payments/${paymentId}/refund`, { method: 'POST', body: {} })
}

// GET /v3/payments?limit=1 — teste AO VIVO da credencial: prova que a URL e a
// chave batem com o mesmo ambiente. Usado por GET /api/saude/pagamentos.
async function verificarChave() {
  try {
    const dados = await chamarApi('/v3/payments?limit=1')
    return { status: 'ok', total: dados?.totalCount ?? null }
  } catch (erro) {
    const msg = String(erro.message || '')
    if (/fornecida é inválida|invalid_access_token/i.test(msg)) return { status: 'invalida', erro: msg }
    if (/não pertence a este ambiente|invalid_environment/i.test(msg)) return { status: 'ambiente_errado', erro: msg }
    if (/não configurada/i.test(msg)) return { status: 'sem_configuracao', erro: msg }
    return { status: 'erro', erro: msg.slice(0, 200) }
  }
}

module.exports = {
  obterPlano,
  criarSubconta,
  criarCustomer,
  criarAssinatura,
  buscarUrlPagamento,
  buscarPagamentosAssinatura,
  cancelarAssinatura,
  montarSplitVendedor,
  criarPagamentoPedidoPix,
  criarPagamentoPedidoCartao,
  buscarPagamento,
  buscarQrPix,
  cancelarPagamento,
  estornarPagamento,
  verificarChave,
  AMBIENTE,
  BASE_URL,
}
