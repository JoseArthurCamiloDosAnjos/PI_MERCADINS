// Diagnóstico do Asaas — somente leitura (não cria nada, não altera nada).
//
//   node scripts/verificarAsaas.js          → ambiente + validade da chave
//   node scripts/verificarAsaas.js --pix    → cria UMA cobrança Pix de teste
//                                             (R$ 5,00) e mostra o QR gerado
//
// O teste --pix cria uma cobrança real se a chave for de produção (ela expira
// sozinha amanhã e ninguém paga) — use só para confirmar que o Pix funciona.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') })

const asaas = require('../src/services/asaasService')

async function principal() {
  console.log('Ambiente escolhido:', asaas.AMBIENTE, `(${asaas.BASE_URL || 'URL não configurada'})`)
  console.log('Chave presente    :', !!process.env.Assas_API_KEY)

  const teste = await asaas.verificarChave()
  console.log('Chave             :', teste.status + (teste.erro ? ` — ${teste.erro}` : ''))

  if (teste.status !== 'ok') {
    console.log('\nPara gerar uma nova chave: painel do Asaas > menu do usuário > Integrações > Chaves API > Gerar chave de API.')
    process.exit(1)
  }

  if (!process.argv.includes('--pix')) {
    console.log('\nChave válida. Rode com --pix para testar a geração do QR code.')
    return
  }

  console.log('\nCriando cobrança Pix de teste…')
  const customer = await asaas.criarCustomer({
    nome: 'Verificacao Mercadins',
    email: `verificacao-${Date.now()}@example.com`,
  })
  const pix = await asaas.criarPagamentoPedidoPix({
    customerId: customer.id,
    valor: 5,
    descricao: 'Verificacao do sistema Pix — Mercadins',
    externalReference: 'pedido:0',
  })
  console.log('Pagamento:', pix.id, '| status:', pix.status, '| vencimento:', pix.vencimento)
  console.log('QR (base64, primeiros 60):', (pix.qrCodeBase64 || '(vazio)').slice(0, 60))
  console.log('Copia e cola (primeiros 60):', (pix.copiaEcola || '(vazio)').slice(0, 60))
  console.log('Link de pagamento:', pix.urlPagamento || '(vazio)')
  console.log(pix.qrCodeBase64 || pix.copiaEcola
    ? '\n✓ Pix gerado com sucesso.'
    : '\n✗ Cobrança criada, mas o QR veio vazio.')
}

principal().catch(e => {
  console.error('\nFALHA:', e.message)
  process.exit(1)
})
