// Script de teste detalhado: verifica resposta real do Resend
require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });

const { Resend } = require('resend');

async function main() {
  const chave = process.env.RESEND_API_KEY;
  if (!chave) {
    console.log('RESEND_API_KEY não definida');
    process.exit(1);
  }

  const resend = new Resend(chave);
  console.log('Enviando e-mail de teste para teste@exemplo.com...');

  const { data, error } = await resend.emails.send({
    from: 'Suporte@mercadins.com.br',
    to: 'teste@exemplo.com',
    subject: 'Teste — Mercadins',
    html: '<p>Teste de envio</p>',
  });

  if (error) {
    console.error('ERRO do Resend:', JSON.stringify(error, null, 2));
    process.exit(1);
  }

  console.log('SUCESSO — e-mail aceito pelo Resend. ID:', data?.id);
  process.exit(0);
}

main().catch(err => {
  console.error('FALHA:', err.message);
  process.exit(1);
});
