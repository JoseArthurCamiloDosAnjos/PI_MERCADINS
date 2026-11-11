// ─────────────────────────────────────────────────────────────────────────────
//  TESTE — "criar OUTRA loja gera outra assinatura e ela aparece em Assinaturas"
//
//  Simula o cenário de quem já tem loja paga e tenta cadastrar uma segunda:
//    A) checkout de uma loja nova com assinatura ATIVA existente → cria uma
//       assinatura nova (antes era bloqueado com "Link de pagamento não recebido")
//    B) reenvio do MESMO formulário com pendência aberta → retoma o MESMO
//       link (não duplica cobrança)
//    C) formulário DIFERENTE com pendência aberta → substitui a pendente
//    D) GET /assinaturas/minha lista todas as assinaturas do usuário
//
//  O Asaas é MOCKADO (as funções do asaasService são trocadas por retornos
//  falsos) — o teste roda sem internet e sem criar cobrança nenhuma.
//
//  SEGURANÇA: só roda com --db=local e só mexe nas assinaturas do vendedor
//  demo (mercadins.demo.loja@gmail.com); no fim ele apaga o que criou.
//
//  Uso: node scripts/teste-segunda-loja.js --db=local
// ─────────────────────────────────────────────────────────────────────────────
require('dotenv').config();
const path = require('path');
const ROOT = path.join(__dirname, '..');

const argDb = process.argv.find((a) => a.startsWith('--db='));
if ((argDb ? argDb.split('=')[1] : process.env.DB_PROVIDER || '').toLowerCase() !== 'local') {
  console.error('❌ Este teste é só para o banco local: node scripts/teste-segunda-loja.js --db=local');
  process.exit(1);
}

// ── Mock do Asaas: mesmas assinaturas de função, retornos falsos ─────────────
const asaas = require(path.join(ROOT, 'src/services/asaasService'));
let seq = 0;
asaas.criarCustomer = async () => ({ id: `cus_mock_${++seq}` });
asaas.criarAssinatura = async () => ({
  id: `sub_mock_${seq}`,
  status: 'ACTIVE',
  nextDueDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
});
asaas.buscarUrlPagamento = async (id) => `http://localhost:3999/pagar/${id}`;
asaas.buscarPagamentosAssinatura = async () => [];
asaas.cancelarAssinatura = async () => ({ status: 'CANCELLED' });

const { criarCheckout, minhaAssinatura } = require(path.join(ROOT, 'src/controllers/assinaturaController'));
const { conectar } = require(path.join(ROOT, 'src/db/neon'));

function mockRes() {
  return {
    code: 200,
    body: null,
    status(c) { this.code = c; return this; },
    json(o) { this.body = o; return this; },
  };
}

function novoPayload(trocas = {}) {
  return {
    codigo_plano: 'profissional',
    ciclo: 'mensal',
    mercado: {
      nome: 'Segunda Loja Teste',
      email: 'segunda.loja.teste@example.com',
      telefone: '16999887766',
      cnpj: '11222333000181',
      descricao: 'Loja criada pelo teste de segunda assinatura',
      cep: '15900-010',
      estado: 'SP',
      cidade: 'Taquaritinga',
      bairro: 'Centro',
      rua: 'Rua das Palmeiras 100',
      plano: 'profissional',
      categorias: ['mercado'],
      horario: {
        1: ['08:00', '18:00'], 2: ['08:00', '18:00'], 3: ['08:00', '18:00'],
        4: ['08:00', '18:00'], 5: ['08:00', '18:00'], 6: ['08:00', '16:00'],
      },
      taxa_entrega: 5,
      pedido_minimo: 30,
      oferece_entrega: true,
      oferece_retirada: true,
      aceite_termos: true,
      ...trocas,
    },
  };
}

const resultados = [];
function check(nome, ok, detalhe = '') {
  resultados.push({ nome, ok: !!ok });
  console.log(`${ok ? '✅' : '❌'} ${nome}${detalhe ? ` — ${detalhe}` : ''}`);
}

(async () => {
  const sql = await conectar();

  // Cenário: vendedor demo que JÁ tem loja e assinatura ativa
  const [vendedor] = await sql`
    SELECT id_usuario FROM usuarios WHERE email = 'mercadins.demo.loja@gmail.com'
  `;
  if (!vendedor) throw new Error('Rode antes: npm run demo:local (contas demo não encontradas)');

  const [loja] = await sql`
    SELECT m.id_mercado FROM mercados m
    JOIN usuarios_mercados um ON um.id_mercado = m.id_mercado AND um.papel = 'dono'
    WHERE um.id_usuario = ${vendedor.id_usuario}
    ORDER BY m.id_mercado LIMIT 1
  `;
  if (!loja) throw new Error('Rode antes: npm run demo:local (nenhuma loja demo)');

  await sql`DELETE FROM assinaturas WHERE id_usuario = ${vendedor.id_usuario}`;
  await sql`
    INSERT INTO assinaturas (id_usuario, id_mercado, codigo_plano, ciclo, valor, status, proximo_pagamento)
    VALUES (${vendedor.id_usuario}, ${loja.id_mercado}, 'basico', 'MENSAL', 79.00, 'ativa', CURRENT_DATE + 30)
  `;

  const reqDe = (body) => ({ usuarioId: vendedor.id_usuario, body, ip: '127.0.0.1' });
  const contar = async () => (await sql`
    SELECT count(*)::int AS total FROM assinaturas WHERE id_usuario = ${vendedor.id_usuario}
  `)[0].total;

  console.log('\n── A) Quem já tem loja cria OUTRA loja ──');
  const rA = mockRes();
  await criarCheckout(reqDe(novoPayload()), rA);
  check('checkout devolve 201 com link de pagamento', rA.code === 201 && !!rA.body?.urlCheckout,
    `code=${rA.code} url=${rA.body?.urlCheckout ? 'sim' : 'não'} ${rA.body?.erro || rA.body?.mensagem || ''}`);
  check('virou uma 2ª assinatura (2 no total)', await contar() === 2, `total=${await contar()}`);

  const nova = (await sql`
    SELECT * FROM assinaturas WHERE id_usuario = ${vendedor.id_usuario} AND status = 'pendente'
    ORDER BY id DESC LIMIT 1
  `)[0];
  check('a nova está pendente e guarda o formulário',
    !!nova && nova.codigo_plano === 'profissional' && !!nova.dados_mercado,
    nova ? `plano=${nova.codigo_plano}` : 'não achou');

  console.log('\n── D) Tela de Assinaturas lista as duas ──');
  const rMinha = mockRes();
  await minhaAssinatura(reqDe({}), rMinha);
  const lista = rMinha.body?.assinaturas || [];
  check('GET /assinaturas/minha devolve 2 assinaturas', lista.length === 2, `total=${lista.length}`);
  check('a ativa mostra a loja que ela cobre',
    lista.some((a) => a.status === 'ativa' && a.mercado?.id_mercado === loja.id_mercado));
  check('a pendente mostra link de pagamento',
    lista.some((a) => a.status === 'pendente' && !!a.url_pagamento));

  console.log('\n── B) Reenviar o MESMO formulário retoma o mesmo link ──');
  const rB = mockRes();
  await criarCheckout(reqDe(novoPayload()), rB);
  check('retoma sem criar cobrança nova (continua 2)', await contar() === 2, `total=${await contar()}`);
  check('devolve o link para retomar', !!rB.body?.urlCheckout && rB.body?.idAssinatura === nova.id,
    rB.body?.mensagem || '');

  console.log('\n── C) Formulário DIFERENTE substitui a pendência ──');
  const rC = mockRes();
  await criarCheckout(reqDe(novoPayload({
    nome: 'Terceira Loja Outro CNPJ',
    email: 'terceira.loja.teste@example.com',
    rua: 'Rua XV de Novembro 45',
  })), rC);
  check('cria a 3ª assinatura', rC.code === 201 && await contar() === 3,
    `code=${rC.code} total=${await contar()}`);
  const antiga = await sql`
    SELECT status FROM assinaturas WHERE id = ${nova.id}
  `;
  check('a pendência antiga foi cancelada', antiga[0]?.status === 'cancelada', antiga[0]?.status);

  // Limpeza: banco volta ao estado de antes do teste
  await sql`DELETE FROM assinaturas WHERE id_usuario = ${vendedor.id_usuario}`;
  console.log('\n(limpeza: assinaturas de teste apagadas)');

  const falhas = resultados.filter((r) => !r.ok).length;
  console.log(`\nResultado: ${resultados.length - falhas}/${resultados.length} verificações OK`);
  process.exit(falhas ? 1 : 0);
})().catch((err) => {
  console.error('❌ Erro no teste:', err);
  process.exit(1);
});
