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

  console.log('\nChave válida e ambiente acessível.')
}

principal().catch(e => {
  console.error('\nFALHA:', e.message)
  process.exit(1)
})
