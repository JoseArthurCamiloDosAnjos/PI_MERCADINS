//  SINCRONIZA O BANCO INTEIRO: PostgreSQL local -> Neon (só nesse sentido)
//
//  O que faz, nesta ordem:
//    1. Localiza pg_dump / pg_restore (PATH, PG_DIR ou C:\Program Files\PostgreSQL\*)
//    2. Confere se local e Neon têm as MESMAS tabelas (se não, pede para rodar as migrações)
//    3. Backup completo do Neon em %TEMP%\opencode\mercadins-backups
//    4. Dump dos DADOS do local (pg_dump --data-only --inserts)
//    5. TRUNCATE em todas as tabelas do Neon
//    6. Restaura os dados no Neon (pg_restore --data-only)
//    7. Verifica tabela a tabela (contagem + hash do conteúdo) e mostra o resultado
//
//  Uso:
//    node scripts/sincronizar-neon.js --executar --confirmar=neon
//    node scripts/sincronizar-neon.js --verificar
//
//  Obs.: é cópia de dados (INSERTs). Estrutura/viões continuam responsabilidade
//  das migrações: rode `node src/db/migrate.js --db=neon` antes se o Neon estiver atrasado.
require('dotenv').config();
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { Pool } = require('pg');

const PASTA_BACKUP = path.join(os.tmpdir(), 'opencode', 'mercadins-backups');

function arg(nome) {
  const achado = process.argv.find((a) => a.startsWith(`--${nome}=`));
  return achado ? achado.split('=').slice(1).join('=') : null;
}
const flag = (nome) => process.argv.includes(`--${nome}`);

function conexao(banco) {
  const url = banco === 'neon' ? process.env.DATABASE_URL_NEON : process.env.DATABASE_URL_LOCAL;
  if (!url) throw new Error(`Variável ${banco === 'neon' ? 'DATABASE_URL_NEON' : 'DATABASE_URL_LOCAL'} não encontrada no .env`);
  return url;
}

// endpoint direto do Neon (sem o pooler) — usado como alternativa se o pooler recusar dump/restore
function direto(url) {
  return url.replace('@ep-', '@ep-').replace('-pooler.', '.');
}

function parse(url) {
  const u = new URL(url);
  return {
    host: u.hostname,
    port: u.port || '5432',
    user: decodeURIComponent(u.username || 'postgres'),
    pass: decodeURIComponent(u.password || ''),
    database: (u.pathname || '/').replace(/^\//, '').split('?')[0],
  };
}

// ------------------------------------------------------- binários do PostgreSQL
function acharBinario(nome) {
  const exe = process.platform === 'win32' ? `${nome}.exe` : nome;
  const candidatos = [];

  if (process.env.PG_DIR) candidatos.push(path.join(process.env.PG_DIR, exe));

  for (const dir of (process.env.PATH || '').split(path.delimiter)) {
    if (dir) candidatos.push(path.join(dir, exe));
  }

  const raizes = process.platform === 'win32'
    ? ['C:\\Program Files\\PostgreSQL', 'C:\\Program Files (x86)\\PostgreSQL']
    : ['/usr/lib/postgresql', '/usr/local/pgsql/bin', '/opt/homebrew/opt/postgresql/bin', '/usr/local/bin', '/usr/bin'];

  for (const raiz of raizes) {
    try {
      if (fs.statSync(raiz).isFile()) { candidatos.push(raiz); continue; }
      for (const item of fs.readdirSync(raiz)) {
        const interno = path.join(raiz, item, 'bin', exe);
        candidatos.push(interno);
        candidatos.push(path.join(raiz, exe));
      }
    } catch { /* pasta inexistente: ignora */ }
  }

  return candidatos.find((c) => { try { return fs.statSync(c).isFile(); } catch { return false; } }) || null;
}

function rodar(bin, args, opcoes = {}) {
  const r = spawnSync(bin, args, { encoding: 'utf8', ...opcoes });
  if (r.error) throw new Error(`Não consegui rodar ${bin}: ${r.error.message}`);
  return { status: r.status, stdout: r.stdout || '', stderr: r.stderr || '' };
}

function exigirBinario(nome) {
  const bin = acharBinario(nome);
  if (!bin) {
    throw new Error(
      `${nome} não encontrado. Instale o PostgreSQL ou defina a variável PG_DIR (ex.: PG_DIR=C:\\Program Files\\PostgreSQL\\18\\bin)`,
    );
  }
  return bin;
}

// ------------------------------------------------------- dump / restore
function dump(banco, arquivo, { dataOnly }) {
  const bin = exigirBinario('pg_dump');
  // no Neon usa o endpoint direto: o pooler (PgBouncer) compartilha conexões e o
  // set_config('search_path','',false) do pg_dump vaza para os outros clientes
  const alvos = banco === 'neon'
    ? [direto(conexao('neon')), conexao('neon')]
    : [conexao(banco)];

  let ultimoErro = '';
  for (const alvo of alvos) {
    const c = parse(alvo);
    const args = [
      '-h', c.host, '-p', c.port, '-U', c.user, '-d', c.database,
      '-Fc', '-f', arquivo, '--no-owner', '--no-privileges',
      // schemas de sistema do Neon (auth) não fazem parte da cópia de dados
      '--exclude-schema=neon_auth', '--exclude-schema=auth',
    ];
    if (dataOnly) args.push('--data-only', '--column-inserts');

    const r = rodar(bin, args, { env: { ...process.env, PGPASSWORD: c.pass } });
    if (r.status === 0) return;
    ultimoErro = r.stderr || r.stdout;
  }
  throw new Error(`pg_dump (${banco}) falhou:\n${ultimoErro}`);
}

// tenta restaurar (pooler e, se preciso, endpoint direto); devolve true se deu certo
function restaurar(arquivo) {
  const bin = exigirBinario('pg_restore');
  const url = conexao('neon');
  let ultimoErro = 'sem conexão';
  // endpoint direto primeiro (evita envenenar o search_path do pooler)
  for (const alvo of [direto(url), url]) {
    const r = rodar(bin, [
      '-d', alvo, '--data-only', '--no-owner', '--no-privileges', '--exit-on-error', arquivo,
    ]);
    if (r.status === 0) {
      if (r.stdout.trim()) console.log(r.stdout.trim());
      return { ok: true, erro: '' };
    }
    ultimoErro = r.stderr || r.stdout;
  }
  return { ok: false, erro: ultimoErro };
}

// ------------------------------------------------------- utilidades de banco
async function poolDe(banco) {
  const pool = new Pool({ connectionString: conexao(banco) });
  await pool.query("SET TimeZone = 'UTC'");
  return pool;
}

async function tabelas(pool) {
  const r = await pool.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name
  `);
  return r.rows.map((x) => x.table_name);
}

// colunas de cada tabela (public) — a cópia exige nomes de colunas iguais nos dois lados
async function colunas(pool) {
  const r = await pool.query(`
    SELECT table_name, column_name FROM information_schema.columns
    WHERE table_schema = 'public' ORDER BY table_name, column_name
  `);
  const mapa = new Map();
  for (const x of r.rows) {
    if (!mapa.has(x.table_name)) mapa.set(x.table_name, []);
    mapa.get(x.table_name).push(x.column_name);
  }
  return mapa;
}

async function truncarTudo(pool) {
  const lista = await tabelas(pool);
  if (!lista.length) return 0;
  await pool.query(`TRUNCATE TABLE ${lista.map((t) => `public."${t}"`).join(', ')} RESTART IDENTITY`);
  return lista.length;
}

// colunas ignoradas na comparação (decisão do usuário: o Neon mantém a própria senha)
const MASCARAR = { usuarios: ['senha'] };

// impressão determinística do conteúdo de uma linha (não depende de PK, de ordem de
// colunas nem da collation do servidor — ordena por bytes, não por texto)
async function assinatura(pool, tabela) {
  const remover = (MASCARAR[tabela] || []).map((c) => `- '${c}'`).join(' ');
  const r = await pool.query(`
    SELECT count(*)::int AS n,
           md5(COALESCE(string_agg(conteudo, E'\n' ORDER BY convert_to(conteudo, 'UTF8')), '')) AS hash
    FROM (SELECT (to_jsonb(t) ${remover})::text AS conteudo FROM "${tabela}" t) s
  `);
  return { n: r.rows[0].n, hash: r.rows[0].hash };
}

// ------------------------------------------------------- etapas
async function verificar() {
  const local = await poolDe('local');
  const neon = await poolDe('neon');
  try {
    const tLocal = await tabelas(local);
    const tNeon = await tabelas(neon);
    const faltaNoNeon = tLocal.filter((t) => !tNeon.includes(t));
    const sobraNoNeon = tNeon.filter((t) => !tLocal.includes(t));

    if (faltaNoNeon.length || sobraNoNeon.length) {
      console.log('⚠️  Estruturas diferentes:');
      if (faltaNoNeon.length) console.log('   faltando no Neon: ' + faltaNoNeon.join(', '));
      if (sobraNoNeon.length) console.log('   só no Neon: ' + sobraNoNeon.join(', '));
    }

    let iguais = 0;
    const divergentes = [];
    for (const t of tLocal.filter((x) => tNeon.includes(x))) {
      const a = await assinatura(local, t);
      const b = await assinatura(neon, t);
      if (a.n === b.n && a.hash === b.hash) iguais += 1;
      else divergentes.push({ tabela: t, local: a.n, neon: b.n });
    }

    console.log(`\nTabelas idênticas (contagem + conteúdo): ${iguais}/${tLocal.length}`);
    if (divergentes.length) {
      console.log('Divergentes:');
      for (const d of divergentes) console.log(`   ${d.tabela}: local=${d.local} neon=${d.neon}`);
      return false;
    }
    console.log('✅ Banco do Neon sincronizado com o local.');
    return true;
  } finally {
    await local.end();
    await neon.end();
  }
}

async function executar() {
  fs.mkdirSync(PASTA_BACKUP, { recursive: true });
  const carimbo = new Date().toISOString().replace(/[:.]/g, '-');

  // 1) estruturas precisam estar iguais antes de copiar dados
  const local = await poolDe('local');
  const neon = await poolDe('neon');
  let tLocal;
  let tNeon;
  let cLocal;
  let cNeon;
  try {
    tLocal = await tabelas(local);
    tNeon = await tabelas(neon);
    cLocal = await colunas(local);
    cNeon = await colunas(neon);
  } finally {
    await local.end();
    await neon.end();
  }

  const faltaNoNeon = tLocal.filter((t) => !tNeon.includes(t));
  if (faltaNoNeon.length) {
    throw new Error(
      `O Neon não tem estas tabelas: ${faltaNoNeon.join(', ')}.\n` +
      'Rode antes: node src/db/migrate.js --db=neon',
    );
  }

  // colunas precisam bater (o dump usa INSERT com nomes de coluna)
  const problemas = [];
  for (const t of tLocal) {
    const a = cLocal.get(t) || [];
    const b = cNeon.get(t) || [];
    const soLocal = a.filter((c) => !b.includes(c));
    const soNeon = b.filter((c) => !a.includes(c));
    if (soLocal.length || soNeon.length) {
      problemas.push(
        `${t}: só local [${soLocal.join(', ')}] / só neon [${soNeon.join(', ')}]`,
      );
    }
  }
  if (problemas.length) {
    throw new Error(
      'Estrutura de colunas diferente — sincronização abortada:\n  ' +
      problemas.join('\n  ') +
      '\nRode as migrações nos dois lados antes (node src/db/migrate.js --db=...)',
    );
  }

  // 2) backup do Neon (estrutura + dados) — sua rede de segurança
  const arquivoBackup = path.join(PASTA_BACKUP, `neon-antes-sync-${carimbo}.dump`);
  console.log('💾 Backup do Neon:', arquivoBackup);
  dump('neon', arquivoBackup, { dataOnly: false });

  // 3) dump dos dados do local
  const arquivoDump = path.join(PASTA_BACKUP, `local-dados-${carimbo}.dump`);
  console.log('📦 Extraindo dados do local:', arquivoDump);
  dump('local', arquivoDump, { dataOnly: true });

  // 4) limpa o Neon e restaura por cima
  const limpar = async () => {
    const p = await poolDe('neon');
    try {
      return await truncarTudo(p);
    } finally {
      await p.end();
    }
  };

  const neon2 = await poolDe('neon');
  let senhas;
  try {
    // senhas em vigor no Neon (por e-mail) — nunca são sobrescritas pelo local
    senhas = new Map(
      (await neon2.query(`SELECT email, senha FROM usuarios`)).rows.map((u) => [u.email, u.senha]),
    );
  } finally {
    await neon2.end();
  }

  let limpas = await limpar();
  console.log(`🧹 Neon: ${limpas} tabelas esvaziadas`);

  console.log('📥 Restaurando dados no Neon...');
  let resultado = { ok: false, erro: '' };
  for (let tentativa = 1; tentativa <= 3 && !resultado.ok; tentativa += 1) {
    if (tentativa > 1) {
      console.warn(`⚠️  Tentativa ${tentativa - 1} falhou (${resultado.erro.trim().split('\n')[0]}); limpando e tentando de novo...`);
      limpas = await limpar();
    }
    resultado = restaurar(arquivoDump);
  }
  if (!resultado.ok) {
    throw new Error(`pg_restore falhou 3x:\n${resultado.erro}`);
  }

  // devolve as senhas de produção que já estavam no Neon
  if (senhas.size) {
    const neon3 = await poolDe('neon');
    try {
      let mantidas = 0;
      for (const [email, senha] of senhas) {
        const r = await neon3.query(
          `UPDATE usuarios SET senha = $1 WHERE email = $2 AND senha IS DISTINCT FROM $1`,
          [senha, email],
        );
        mantidas += r.rowCount;
      }
      console.log(`🔑 Senhas do Neon preservadas: ${mantidas}/${senhas.size} (a coluna "senha" fica fora da conferência)`);
    } finally {
      await neon3.end();
    }
  }

  // 5) conferência
  const ok = await verificar();
  console.log('\nBackup para desfazer:');
  console.log(`  pg_restore -d "${conexao('neon')}" --no-owner --no-privileges "${arquivoBackup}"`);
  if (!ok) process.exitCode = 1;
}

// ------------------------------------------------------- CLI
(async () => {
  if (flag('verificar')) {
    await verificar();
  } else if (flag('executar')) {
    if (arg('confirmar') !== 'neon') {
      console.error('❌ Confirme com --confirmar=neon (isso sobrescreve o banco de produção)');
      process.exit(1);
    }
    await executar();
  } else {
    console.log('Uso: --executar --confirmar=neon   |   --verificar');
    process.exit(1);
  }
  process.exit(process.exitCode || 0);
})().catch((err) => {
  console.error('❌ Erro:', err.message);
  process.exit(1);
});
