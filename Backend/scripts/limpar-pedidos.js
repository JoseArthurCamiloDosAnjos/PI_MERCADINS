//  LIMPAR PEDIDOS DO BANCO DE DADOS
//
//  Os pedidos ficam na tabela "historico_compras" e os repasses de pagamento
//  do vendedor em "repasses" (ligados por id_pedido). Este script apaga os dois.
//
//  Uso:
//    node scripts/limpar-pedidos.js --db=local --simular
//    node scripts/limpar-pedidos.js --db=local --confirmar=local
//    node scripts/limpar-pedidos.js --db=neon  --confirmar=neon
//
//  Opções:
//    --mercado=<id>   apaga somente os pedidos daquele mercado
//    --usuario=<id>   apaga somente os pedidos daquele usuário (comprador)
//    --notificacoes   apaga também os logs de notificação de pedidos
//    --simular        apenas mostra o que seria apagado (nada é alterado)

require('dotenv').config();
const { conectar } = require('../src/db/neon');

function interpretarArgs() {
  const argDb = process.argv.find((a) => a.startsWith('--db='));
  const banco = argDb ? argDb.split('=')[1].toLowerCase() : '';

  const argConfirmar = process.argv.find((a) => a.startsWith('--confirmar='));
  const confirmacao = argConfirmar ? argConfirmar.split('=')[1].toLowerCase() : '';

  const argMercado = process.argv.find((a) => a.startsWith('--mercado='));
  const argUsuario = process.argv.find((a) => a.startsWith('--usuario='));

  const simular = process.argv.includes('--simular');
  const notificacoes = process.argv.includes('--notificacoes');
  const mercado = argMercado ? Number(argMercado.split('=')[1]) : null;
  const usuario = argUsuario ? Number(argUsuario.split('=')[1]) : null;

  if (!['local', 'neon'].includes(banco)) {
    console.error('❌ Informe o banco: node scripts/limpar-pedidos.js --db=local (ou --db=neon)');
    console.error('   Use --simular para só visualizar e --confirmar=<banco> para executar.');
    process.exit(1);
  }
  if ((argMercado && !Number.isInteger(mercado)) || (argUsuario && !Number.isInteger(usuario))) {
    console.error('❌ IDs inválidos. Use --mercado=12 ou --usuario=34 (somente números).');
    process.exit(1);
  }
  if (!simular && confirmacao !== banco) {
    console.error(`❌ Este comando apaga pedidos definitivamente do banco ${banco.toUpperCase()}.`);
    console.error(`   Para executar, digite:`);
    console.error(`   node scripts/limpar-pedidos.js --db=${banco} --confirmar=${banco}`);
    console.error(`   (ou use --simular para ver o que seria apagado)`);
    process.exit(1);
  }

  return { banco, simular, notificacoes, mercado, usuario };
}

// ids = null significa "todos os pedidos" (sem filtro)
async function selecionarIds(sql, { mercado, usuario }) {
  if (mercado && usuario) {
    return (await sql`
      SELECT id FROM historico_compras
      WHERE id_mercado = ${mercado} AND id_usuario = ${usuario}
    `).map((r) => r.id);
  }
  if (mercado) {
    return (await sql`
      SELECT id FROM historico_compras WHERE id_mercado = ${mercado}
    `).map((r) => r.id);
  }
  if (usuario) {
    return (await sql`
      SELECT id FROM historico_compras WHERE id_usuario = ${usuario}
    `).map((r) => r.id);
  }
  return null;
}

async function contar(sql, ids) {
  const pedidos = ids
    ? ids.length
    : (await sql`SELECT count(*)::int AS total FROM historico_compras`)[0].total;

  const repasses = ids
    ? (await sql`SELECT count(*)::int AS total FROM repasses WHERE id_pedido = ANY(${ids}::int[])`)[0].total
    : (await sql`SELECT count(*)::int AS total FROM repasses`)[0].total;

  const pendentes = ids
    ? (await sql`
        SELECT count(*)::int AS total FROM historico_compras
        WHERE id = ANY(${ids}::int[]) AND status = 'aguardando_pagamento'
      `)[0].total
    : (await sql`
        SELECT count(*)::int AS total FROM historico_compras
        WHERE status = 'aguardando_pagamento'
      `)[0].total;

  return { pedidos, repasses, pendentes };
}

async function zerarSequencias(sql) {
  try {
    await sql`
      DO $seq$
      DECLARE
        m INTEGER;
      BEGIN
        SELECT COALESCE(MAX(id), 0) INTO m FROM historico_compras;
        IF m > 0 THEN
          PERFORM setval('historico_compras_id_seq', m);
        ELSE
          PERFORM setval('historico_compras_id_seq', 1, false);
        END IF;

        SELECT COALESCE(MAX(id), 0) INTO m FROM repasses;
        IF m > 0 THEN
          PERFORM setval('repasses_id_seq', m);
        ELSE
          PERFORM setval('repasses_id_seq', 1, false);
        END IF;
      END
      $seq$
    `;
  } catch (erro) {
    console.warn('⚠️  Não foi possível zerar as sequências:', erro.message);
  }
}

async function contarNotificacoes(sql, { mercado, usuario }) {
  if (mercado) {
    return (await sql`
      SELECT count(*)::int AS total FROM notificacoes
      WHERE tipo LIKE 'pedido%' AND id_mercado = ${mercado}
    `)[0].total;
  }
  if (usuario) {
    return (await sql`
      SELECT count(*)::int AS total FROM notificacoes
      WHERE tipo LIKE 'pedido%' AND id_usuario = ${usuario}
    `)[0].total;
  }
  return (await sql`
    SELECT count(*)::int AS total FROM notificacoes WHERE tipo LIKE 'pedido%'
  `)[0].total;
}

async function apagarNotificacoes(sql, { mercado, usuario }) {
  if (mercado) {
    await sql`
      DELETE FROM notificacoes WHERE tipo LIKE 'pedido%' AND id_mercado = ${mercado}
    `;
    return;
  }
  if (usuario) {
    await sql`
      DELETE FROM notificacoes WHERE tipo LIKE 'pedido%' AND id_usuario = ${usuario}
    `;
    return;
  }
  await sql`
    DELETE FROM notificacoes WHERE tipo LIKE 'pedido%'
  `;
}

(async () => {
  const args = interpretarArgs();
  process.env.DB_PROVIDER = args.banco;

  const sql = await conectar();

  const escopo = args.mercado
    ? ` do mercado #${args.mercado}`
    : args.usuario
      ? ` do usuário #${args.usuario}`
      : '';

  console.log(`\n🧹 ${args.simular ? 'Simulando limpeza' : 'Limpando pedidos'}${escopo} — banco ${args.banco.toUpperCase()}`);

  const ids = await selecionarIds(sql, args);
  const antes = await contar(sql, ids);
  const notif = args.notificacoes ? await contarNotificacoes(sql, args) : 0;

  console.log(`   Pedidos encontrados: ${antes.pedidos}`);
  console.log(`   Repasses vinculados: ${antes.repasses}`);
  if (notif > 0) console.log(`   Notificações de pedido: ${notif}`);

  if (antes.pedidos === 0 && notif === 0) {
    console.log('✅ Nada para apagar.');
    process.exit(0);
  }

  if (args.simular) {
    console.log('\n🔎 Modo simulado — nada foi alterado.');
    console.log('   Para apagar de verdade:');
    console.log(`   node scripts/limpar-pedidos.js --db=${args.banco} --confirmar=${args.banco}${args.mercado ? ` --mercado=${args.mercado}` : ''}${args.usuario ? ` --usuario=${args.usuario}` : ''}${args.notificacoes ? ' --notificacoes' : ''}`);
    process.exit(0);
  }

  if (antes.pendentes > 0) {
    console.log(`\n⚠️  ${antes.pendentes} pedido(s) com status "aguardando_pagamento".`);
    console.log('   Este script apaga só o banco — as cobranças abertas no Asaas continuam lá.');
    console.log('   Cancele no painel do Asaas se não quiser que elas fiquem pendentes.');
  }

  // Ordem importa: repasses referenciam os pedidos (sem FK, apagamos na mão)
  if (ids) {
    if (ids.length > 0) {
      await sql`DELETE FROM repasses   WHERE id_pedido = ANY(${ids}::int[])`;
      await sql`DELETE FROM historico_compras WHERE id = ANY(${ids}::int[])`;
    }
  } else {
    await sql`DELETE FROM repasses`;
    await sql`DELETE FROM historico_compras`;
  }

  let notifApagadas = 0;
  if (args.notificacoes) {
    await apagarNotificacoes(sql, args);
    notifApagadas = notif;
  }

  // Só zera a sequência quando apagamos tudo (senão os ids continuam coerentes)
  if (!ids) await zerarSequencias(sql);

  const depois = await contar(sql, ids);

  console.log('\n✅ Limpeza concluída:');
  console.log(`   Pedidos removidos: ${antes.pedidos}`);
  console.log(`   Repasses removidos: ${antes.repasses}`);
  if (args.notificacoes) console.log(`   Notificações removidas: ${notifApagadas}`);
  console.log(`   Pedidos restantes: ${depois.pedidos}`);
  process.exit(0);
})().catch((err) => {
  console.error('❌ Erro ao limpar pedidos:', err.message);
  process.exit(1);
});
