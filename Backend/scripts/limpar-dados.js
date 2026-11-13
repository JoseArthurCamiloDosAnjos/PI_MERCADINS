//  LIMPAR DADOS DO BANCO (mantendo os administradores)
require('dotenv').config();
const { conectar } = require('../src/db/neon');

const TABELAS_PRESERVADAS = ['usuarios', 'schema_migrations'];

function interpretarArgs() {
  const argDb = process.argv.find((a) => a.startsWith('--db='));
  const banco = argDb ? argDb.split('=')[1].toLowerCase() : '';
  const confirmado = process.argv.includes('--confirmar=neon');

  if (!['local', 'neon'].includes(banco)) {
    console.error('❌ Informe o banco: node scripts/limpar-dados.js --db=local (ou --db=neon)');
    process.exit(1);
  }
  if (banco === 'neon' && !confirmado) {
    console.error('❌ Neon é o banco de produção. Para limpá-lo, digite:');
    console.error('   node scripts/limpar-dados.js --db=neon --confirmar=neon');
    process.exit(1);
  }
  return banco;
}

(async () => {
  const banco = interpretarArgs();
  process.env.DB_PROVIDER = banco;

  const sql = await conectar();
  console.log(`\n🧹 Limpando dados do banco: ${banco.toUpperCase()}`);

  await sql`
    DO $limpar$
    DECLARE
      stmt TEXT;
    BEGIN
      SELECT format(
               'TRUNCATE TABLE %s RESTART IDENTITY',
               string_agg(format('public.%I', table_name), ', ')
             )
        INTO stmt
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
        AND table_name <> ALL(ARRAY['usuarios', 'schema_migrations']);

      IF stmt IS NOT NULL THEN
        EXECUTE stmt;
      END IF;
    END
    $limpar$
  `;

  const [conta] = await sql`
    SELECT count(*)::int AS total FROM usuarios WHERE is_admin IS NOT TRUE
  `;
  await sql`DELETE FROM usuarios WHERE is_admin IS NOT TRUE`;

  await sql`
    DO $seq$
    DECLARE
      m INTEGER;
    BEGIN
      SELECT COALESCE(MAX(id_usuario), 0) INTO m FROM usuarios;
      IF m > 0 THEN
        PERFORM setval('usuarios_id_usuario_seq', m);
      ELSE
        PERFORM setval('usuarios_id_usuario_seq', 1, false);
      END IF;
    END
    $seq$
  `;

  const [admins] = await sql`
    SELECT count(*)::int AS total FROM usuarios WHERE is_admin = TRUE
  `;
  const [tabelas] = await sql`
    SELECT count(*)::int AS total FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  `;

  console.log(`✅ Registros apagados: todos (exceto administradores)`);
  console.log(`✅ Usuários comuns removidos: ${conta.total}`);
  console.log(`✅ Administradores mantidos: ${admins.total}`);
  console.log(`✅ Tabelas preservadas (estrutura): ${tabelas.total}`);
  console.log('\nPronto para popular de novo: node scripts/dados-demo.js --db=' + banco);
  process.exit(0);
})().catch((err) => {
  console.error('❌ Erro ao limpar o banco:', err.message);
  process.exit(1);
});
