require('dotenv').config()

//  Ambiente do Asaas — sandbox × produção

function resolverAmbiente() {
  const forcado = String(process.env.ASAAS_AMBIENTE || '').toLowerCase().trim()
  if (forcado === 'sandbox' || forcado === 'producao') return forcado

  // Produção só por EXPLÍCITO: chave legada de produção quando não há chaves
  // por ambiente configuradas. NODE_ENV/RENDER NÃO inferem produção — o
  // deploy no Render permanece em sandbox até ASAAS_AMBIENTE=producao ser
  // definido (com autorização explícita e credenciais correspondentes).
  const temChavePorAmbiente = !!(process.env.Assas_API_KEY_Producao || process.env.Assas_API_KEY_Sandbox)
  if (!temChavePorAmbiente) {
    const legada = (process.env.Assas_API_KEY || '').trim()
    if (legada.startsWith('$aact_prod_')) return 'producao'
    if (legada.startsWith('$aact_hmlg_')) return 'sandbox'
  }

  console.warn(
    'asaasService: ASAAS_AMBIENTE não definido — usando sandbox (default seguro). ' +
    'Para produção, defina ASAAS_AMBIENTE=producao explicitamente.'
  )
  return 'sandbox'
}

const AMBIENTE = resolverAmbiente()

/** Chave da API do ambiente ativo (a específica, senão a legada). */
function chaveApi() {
  if (AMBIENTE === 'producao') {
    return process.env.Assas_API_KEY_Producao || process.env.Assas_API_KEY || ''
  }
  return process.env.Assas_API_KEY_Sandbox || process.env.Assas_API_KEY || ''
}

/** Nome da variável de onde a chave ativa veio (para log/diagnóstico). */
function fonteChave() {
  if (AMBIENTE === 'producao') {
    if (process.env.Assas_API_KEY_Producao) return 'Assas_API_KEY_Producao'
  } else if (process.env.Assas_API_KEY_Sandbox) {
    return 'Assas_API_KEY_Sandbox'
  }
  return process.env.Assas_API_KEY ? 'Assas_API_KEY' : null
}

const BASE_URL = (
  (AMBIENTE === 'producao'
    ? process.env.Assas_API_URL_Producao
    : process.env.Assas_API_URL_Sandbox) || ''
).replace(/\/+$/, '')

if (!BASE_URL) {
  console.error(
    `asaasService: URL da API não configurada (esperando ${
      AMBIENTE === 'producao' ? 'Assas_API_URL_Producao' : 'Assas_API_URL_Sandbox'
    } para o ambiente "${AMBIENTE}")`
  )
} else {
  console.log(
    `Asaas: ambiente ${AMBIENTE} → ${BASE_URL} [chave: ${fonteChave() || 'AUSENTE'}]`
  )
}

if (String(process.env.ASAAS_AMBIENTE || '').trim()) {
  const legada = (process.env.Assas_API_KEY || '').trim()
  if (AMBIENTE === 'sandbox' && legada.startsWith('$aact_prod_')) {
    console.error('asaasService: ASAAS_AMBIENTE=sandbox com chave de PRODUÇÃO — as chamadas vão falhar com 401 (invalid_environment).')
  }
  if (AMBIENTE === 'producao' && legada.startsWith('$aact_hmlg_')) {
    console.error('asaasService: ASAAS_AMBIENTE=producao com chave de SANDBOX — as chamadas vão falhar com 401 (invalid_environment).')
  }
}

const PLANOS = {
  basico: {
    nome: 'Essencial',
    mensal: 79.0,
    anual: Math.floor(79 * 0.8) * 12,
  },
  profissional: {
    nome: 'Plus',
    mensal: 149.0,
    anual: Math.floor(149 * 0.8) * 12,
  },
}

function obterPlano(codigoPlano, ciclo) {
  const plano = PLANOS[codigoPlano]
  if (!plano) return null
  const valor = ciclo === 'ANUAL' ? plano.anual : plano.mensal
  return { codigo: codigoPlano, nome: plano.nome, ciclo, valor }
}

async function chamarApi(path, { method = 'GET', body } = {}) {
  const chave = chaveApi()
  if (!chave) {
    throw new Error(
      `Chave da API do Asaas não configurada (esperando Assas_API_KEY_${AMBIENTE === 'producao' ? 'Producao' : 'Sandbox'} ou Assas_API_KEY).`
    )
  }
  if (!BASE_URL) {
    throw new Error('URL da API do Asaas não configurada.')
  }

  const resposta = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      access_token: chave,
    },
    ...(body !== undefined && { body: JSON.stringify(body) }),
  })

  const dados = await resposta.json().catch(() => null)

  if (!resposta.ok) {
    const lista = Array.isArray(dados?.errors) ? dados.errors : []
    const detalhes = lista.length
      ? lista.map(e => [e?.code, e?.description || e?.message].filter(Boolean).join(': ')).filter(Boolean).join('; ')
      : (typeof dados?.message === 'string' && dados.message) ||
        (typeof dados?.error === 'string' && dados.error) ||
        (typeof dados === 'string' ? dados : '')
    const erro = new Error(detalhes || `Erro na API do Asaas (${resposta.status}).`)
    erro.code = lista.map(e => e?.code).filter(Boolean).join(' ') || null
    erro.status = resposta.status
    console.error(
      `asaasService: ${resposta.status} ${method} ${path} →`,
      JSON.stringify(dados)?.slice(0, 800)
    )
    throw erro
  }

  return dados
}

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

async function criarCustomer({ nome, email, cpfCnpj, mobilePhone }) {
  const body = { name: nome, email }
  if (cpfCnpj) body.cpfCnpj = cpfCnpj
  if (mobilePhone) body.mobilePhone = mobilePhone
  return chamarApi('/v3/customers', { method: 'POST', body })
}

async function criarAssinatura({ customerId, valor, ciclo, descricao, redirectUrl }) {
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
  if (redirectUrl) {
    corpo.callback = { successUrl: redirectUrl, autoRedirect: true }
  }

  try {
    const assinatura = await chamarApi('/v3/subscriptions', { method: 'POST', body: corpo })
    return { ...assinatura, semRedirect: false }
  } catch (erro) {
    if (corpo.callback && erro.status >= 400 && erro.status < 500 && erroDeCallbackRecusado(erro.message, erro.code)) {
      avisarCallbackDescartado('assinatura', redirectUrl, erro.message)
      delete corpo.callback
      try {
        const assinatura = await chamarApi('/v3/subscriptions', { method: 'POST', body: corpo })
        if (!assinatura?.id) throw new Error('Asaas não devolveu o id da assinatura.')
        return { ...assinatura, semRedirect: true }
      } catch (erroSemCallback) {
        throw erroSemCallback
      }
    }
    throw erro
  }
}

function erroDeCallbackRecusado(msg, code) {
  const texto = `${String(msg || '')} ${String(code || '')}`;
  return /successUrl|callback|dom[ií]nio|domain|redirect[\s_-]?url|return[\s_-]?url|autoRedirect/i.test(texto);
}

function avisarCallbackDescartado(origem, redirectUrl, motivo) {
  console.warn(
    `Asaas: retorno automático NÃO configurado na ${origem} — cobrança criada SEM redirecionamento. ` +
    `URL: ${redirectUrl} | motivo: ${motivo} | ` +
    'Corrigir: painel Asaas → Configurações da conta → Informações → cadastrar o domínio.'
  )
}

async function buscarUrlPagamento(subscriptionId) {
  const dados = await chamarApi(`/v3/payments?subscription=${subscriptionId}&limit=1`)
  const pagamento = dados?.data?.[0]
  return pagamento?.invoiceUrl || null
}

async function buscarPagamentosAssinatura(subscriptionId, limite = 10) {
  const dados = await chamarApi(
    `/v3/payments?subscription=${subscriptionId}&limit=${limite}&order=DESC`
  )
  return Array.isArray(dados?.data) ? dados.data : []
}

async function cancelarAssinatura(subscriptionId) {
  return chamarApi(`/v3/subscriptions/${subscriptionId}`, { method: 'DELETE' })
}

//  Pagamento de PEDIDO (compra de produtos, não assinatura)

function vencimentoPedido() {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().slice(0, 10)
}

//  Split de pagamento (repasse automático ao vendedor)
function montarSplitVendedor(walletId, externalReference) {
  if (!walletId) return null;
  const split = {
    walletId: String(walletId).trim(),
    percentualValue: 100,
  };
  if (externalReference) split.externalReference = String(externalReference).slice(0, 100);
  return [split];
}

//  QR do Pix
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

// Dois fluxos para a MESMA cobrança Pix:
//  (a) QR Code exibido dentro do Mercadins (/pedidos/:id) — o cliente paga no
//      app bancário e o status chega por webhook/polling; o callback é inerte;
//  (b) página hospedada do Asaas (invoiceUrl, link "Abrir a página de
//      pagamento") — aqui o callback.successUrl faz sentido (retorno automático).
// Por isso o callback NÃO é removido do Pix: só age no fluxo (b).
async function criarPagamentoPedidoPix({ customerId, valor, descricao, externalReference, redirectUrl, splits }) {
  const corpo = {
    customer: customerId,
    billingType: 'PIX',
    value: valor,
    description: descricao,
    dueDate: vencimentoPedido(),
    externalReference,
  };
  if (Array.isArray(splits) && splits.length > 0) corpo.splits = splits;
  if (redirectUrl) {
    corpo.callback = { successUrl: redirectUrl, autoRedirect: true }
  }

  let pagamento
  let semRedirect = false
  try {
    pagamento = await chamarApi('/v3/payments', { method: 'POST', body: corpo })
  } catch (erro) {
    if (corpo.callback && erro.status >= 400 && erro.status < 500 && erroDeCallbackRecusado(erro.message, erro.code)) {
      avisarCallbackDescartado('cobrança Pix', redirectUrl, erro.message)
      delete corpo.callback
      try {
        pagamento = await chamarApi('/v3/payments', { method: 'POST', body: corpo })
        semRedirect = true
      } catch (erroSemCallback) {
        throw erroSemCallback
      }
    } else {
      throw erro
    }
  }
  // semRedirect só existe junto com uma cobrança efetivamente criada.
  if (semRedirect && !pagamento?.id) semRedirect = false
  let qr = null
  try {
    qr = await buscarQrPixComRetry(pagamento.id)
  } catch (erroQr) {
    console.error('asaasService: não foi possível buscar o QR do Pix:', erroQr.message)
  }
  const embutido = pagamento?.pixTransaction?.[0] || null
  const fonte = qr?.encodedImage || qr?.payload ? qr : embutido
  const { qrCodeBase64, copiaEcola } = normalizarQr(fonte)
  return {
    id: pagamento.id,
    status: pagamento.status,
    vencimento: pagamento.dueDate || null,
    qrCodeBase64,
    copiaEcola,
    urlPagamento: pagamento.invoiceUrl || '',
    split: Array.isArray(pagamento.split) ? pagamento.split : [],
    semRedirect,
  }
}

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
      semRedirect: false,
    }
  } catch (erro) {
    if (corpo.callback && erro.status >= 400 && erro.status < 500 && erroDeCallbackRecusado(erro.message, erro.code)) {
      avisarCallbackDescartado('cobrança de cartão', redirectUrl, erro.message)
      delete corpo.callback
      try {
        const pagamento = await chamarApi('/v3/payments', { method: 'POST', body: corpo })
        if (!pagamento?.id) throw new Error('Asaas não devolveu o id da cobrança.')
        return {
          id: pagamento.id,
          status: pagamento.status,
          vencimento: pagamento.dueDate || null,
          urlPagamento: pagamento.invoiceUrl || '',
          split: Array.isArray(pagamento.split) ? pagamento.split : [],
          semRedirect: true,
        }
      } catch (erroSemCallback) {
        throw erroSemCallback
      }
    }
    throw erro
  }
}

async function buscarPagamento(paymentId) {
  return chamarApi(`/v3/payments/${paymentId}`)
}

// Busca cobrança já criada para um externalReference (ex.: "pedido:123").
// Usada antes de REcriar cobranças em fallbacks — evita duplicatas quando a
// primeira chamada chegou ao Asaas mas a resposta se perdeu (rede/timeout).
async function buscarPagamentoPorExternalReference(externalReference) {
  if (!externalReference) return null
  const ref = String(externalReference)
  const dados = await chamarApi(
    `/v3/payments?externalReference=${encodeURIComponent(ref)}&limit=10&order=DESC`
  )
  const lista = Array.isArray(dados?.data) ? dados.data : []
  // Considera apenas cobranças "vivas" (não deletadas).
  return lista.find((p) => p && p.id && p.status !== 'DELETED') || null
}

// ── Máquina de estados dos pagamentos Asaas ─────────────────────────────────
// Classes distintas — NÃO tratar todos como equivalentes:
//   pago_aprovado  → CONFIRMED (aprovado; funds em compensação, ex.: cartão)
//   pago_liquidado → RECEIVED / RECEIVED_IN_CASH (valor disponível)
//   aguardando     → PENDING / AWAITING_RISK_ANALYSIS / PENDING_RISK_ANALYSIS
//   vencido        → OVERDUE (vencida; assinatura → inadimplente)
//   falha          → DELETED / FAILED / EXPIRED (cobrança não concretizada)
//   estorno_solicitado → REFUND_REQUESTED (ainda NÃO é estorno concluído)
//   estorno_concluido  → REFUNDED / CHARGBACK_* (valor devolvido/contestado)
const STATUS_PAGOS_APROVADO = ['CONFIRMED']
const STATUS_PAGOS_LIQUIDADO = ['RECEIVED', 'RECEIVED_IN_CASH']
const STATUS_AGUARDANDO = ['PENDING', 'AWAITING_RISK_ANALYSIS', 'PENDING_RISK_ANALYSIS']
const STATUS_VENCIDO = ['OVERDUE']
const STATUS_FALHA = ['DELETED', 'FAILED', 'EXPIRED']
const STATUS_ESTORNO_SOLICITADO = ['REFUND_REQUESTED']
const STATUS_ESTORNO_CONCLUIDO = [
  'REFUNDED',
  'CHARGBACK_REQUESTED',
  'CHARGBACK_DISPUTE',
  'AWAITING_CHARGEBACK_REVERSAL',
]

function classificarStatusAsaas(status) {
  const s = String(status || '')
  if (STATUS_PAGOS_APROVADO.includes(s)) return 'pago_aprovado'
  if (STATUS_PAGOS_LIQUIDADO.includes(s)) return 'pago_liquidado'
  if (STATUS_AGUARDANDO.includes(s)) return 'aguardando'
  if (STATUS_VENCIDO.includes(s)) return 'vencido'
  if (STATUS_FALHA.includes(s)) return 'falha'
  if (STATUS_ESTORNO_SOLICITADO.includes(s)) return 'estorno_solicitado'
  if (STATUS_ESTORNO_CONCLUIDO.includes(s)) return 'estorno_concluido'
  return 'desconhecido'
}

// Pagamento efetivamente realizado (inicia preparo do pedido / ativa assinatura).
function pagamentoPago(status) {
  const c = classificarStatusAsaas(status)
  return c === 'pago_aprovado' || c === 'pago_liquidado'
}

// Classificação do ERRO de uma chamada à API para o fallback do pedido:
//   validacao → 4xx: cobrança NÃO criada (rollback seguro)
//   servidor  → 5xx: provavelmente não criada (rollback + msg indisponível)
//   rede      → sem status HTTP (fetch falhou/timeout): AMBÍGUO — a cobrança
//               pode ter sido criada; consultar por externalReference antes
//               de desfazer o pedido.
function classificarErroAsaas(erro) {
  const status = Number(erro?.status)
  if (Number.isFinite(status) && status >= 400 && status < 500) return 'validacao'
  if (Number.isFinite(status) && status >= 500) return 'servidor'
  return 'rede'
}

async function buscarQrPix(paymentId) {
  const qr = await buscarQrPixComRetry(paymentId, 2)
  const { qrCodeBase64, copiaEcola } = normalizarQr(qr)
  return { encodedImage: qrCodeBase64, payload: copiaEcola }
}

async function cancelarPagamento(paymentId) {
  return chamarApi(`/v3/payments/${paymentId}`, { method: 'DELETE' })
}

async function estornarPagamento(paymentId) {
  return chamarApi(`/v3/payments/${paymentId}/refund`, { method: 'POST', body: {} })
}

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

//  Auto-verificação na subida do servidor (chamada leve, somente-leitura)
async function verificarConexao() {
  try {
    await chamarApi('/v3/payments?limit=1')
    return { ok: true, ambiente: AMBIENTE, url: BASE_URL || null, fonte: fonteChave() }
  } catch (erro) {
    return {
      ok: false,
      ambiente: AMBIENTE,
      url: BASE_URL || null,
      fonte: fonteChave(),
      erro: String(erro.message || erro),
    }
  }
}

module.exports = {
  ambienteAsaas: () => AMBIENTE,
  baseUrlAsaas: () => BASE_URL || null,
  chaveApi,
  fonteChave,
  resolverAmbiente,
  verificarConexao,

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
  buscarPagamentoPorExternalReference,
  buscarQrPix,
  cancelarPagamento,
  estornarPagamento,
  classificarStatusAsaas,
  pagamentoPago,
  classificarErroAsaas,
  verificarChave,
  AMBIENTE,
  BASE_URL,
}
