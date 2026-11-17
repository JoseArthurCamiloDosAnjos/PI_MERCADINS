//  Envia o e-mail real de 2FA pelo Resend e mostra a resposta da API.
//  Uso: node scripts/teste-email-2fa.js [destino]
require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });

const { enviarEmail2FA } = require('../src/utils/mailer');

async function main() {
  const destino = process.argv[2] || 'teste@exemplo.com';
  const codigo = '123456';

  console.log(`Enviando e-mail de 2FA para ${destino}...`);
  await enviarEmail2FA(destino, codigo);
  console.log('SUCESSO — e-mail de 2FA aceito pelo Resend.');
  process.exit(0);
}

main().catch((err) => {
  console.error('FALHA:', err.message);
  process.exit(1);
});
