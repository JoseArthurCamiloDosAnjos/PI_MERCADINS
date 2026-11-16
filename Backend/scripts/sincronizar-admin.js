//  SINCRONIZA/limpa os dois bancos mantendo apenas:
//    • contas de administrador (is_admin = true) — cada banco mantém a própria senha
//    • mercados dono de contas adm + seus vínculos, categorias e produtos
//    • itens do catálogo do admin (produtos_catalogo)
//
//  Uso:
//    node scripts/sincronizar-admin.js --exportar
//    node scripts/sincronizar-admin.js --db=neon    --aplicar --confirmar=neon
//    node scripts/sincronizar-admin.js --db=local   --aplicar --confirmar=local
//    node scripts/sincronizar-admin.js --verificar
//
//  O --exportar grava o backup JSON (backup-admin-export.json) lido depois pelo --aplicar.
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const ARQUIVO_EXPORT = path.join(__dirname, 'backup-admin-export.json');
const URL_LOCAL = 'http://localhost:3001';
const URL_PRODUCAO = 'https://pi-mercadins.onrender.com';

// tabelas que NÃO são truncadas (fonte de verdade das contas adm e do histórico de migrações)
const TABELAS_PROTEGIDAS = ['usuarios', 'schema_migrations'];

const SEQUENCIAS = [
  ['usuarios', 'id_usuario'],
  ['mercados', 'id_mercado'],
  ['usuarios_mercados', 'id'],
  ['categorias', 'id_categoria'],
  ['produtos', 'id_produto'],
  ['produtos_catalogo', 'id'],
];

function arg(nome) {
  const achado = process.argv.find((a) => a.startsWith(`--${nome}=`));
  return achado ? achado.split('=').slice(1).join('=') : null;
}
const flag = (nome) => process.argv.includes(`--${nome}`);

function URL(banco) {
  return banco === 'neon' ? process.env.DATABASE_URL_NEON : process.env.DATABASE_URL_LOCAL;
}

// reescreve URLs localhost -> backend de produção (usado só ao gravar no Neon)
function reescreverUrl(valor) {
  if (typeof valor === 'string') return valor.split(URL_LOCAL).join(URL_PRODUCAO);
  if (Array.isArray(valor)) return valor.map(reescreverUrl);
  if (valor && typeof valor === 'object') {
    return Object.fromEntries(Object.entries(valor).map(([k, v]) => [k, reescreverUrl(v)]));
  }
  return valor;
}

// ---------------------------------------------------------------- EXPORTAR
async function exportar() {
  const pool = new Pool({ connectionString: URL('local') });
  try {
    const admins = (await pool.query(`
      SELECT * FROM usuarios WHERE is_admin = TRUE ORDER BY id_usuario
    `)).rows;

    const mercados = (await pool.query(`
      SELECT * FROM mercados
      WHERE id_mercado IN (
        SELECT um.id_mercado FROM usuarios_mercados um
        JOIN usuarios u ON u.id_usuario = um.id_usuario
        WHERE u.is_admin = TRUE AND um.papel IN ('dono', 'admin')
      )
      ORDER BY id_mercado
    `)).rows;

    const vinculos = (await pool.query(`
      SELECT * FROM usuarios_mercados
      WHERE id_mercado IN (${mercados.map((m) => m.id_mercado).join(',') || 'NULL'})
        AND id_usuario IN (SELECT id_usuario FROM usuarios WHERE is_admin = TRUE)
      ORDER BY id
    `)).rows;

    const categorias = (await pool.query(`
      SELECT * FROM categorias
      WHERE id_mercado IN (${mercados.map((m) => m.id_mercado).join(',') || 'NULL'})
      ORDER BY id_categoria
    `)).rows;

    const produtos = (await pool.query(`
      SELECT * FROM produtos
      WHERE id_categoria IN (${categorias.map((c) => c.id_categoria).join(',') || 'NULL'})
      ORDER BY id_produto
    `)).rows;

    const catalogo = (await pool.query(`SELECT * FROM produtos_catalogo ORDER BY id`)).rows;

    const dados = { gerado_em: new Date().toISOString(), admins, mercados, vinculos, categorias, produtos, catalogo };
    fs.writeFileSync(ARQUIVO_EXPORT, JSON.stringify(dados, null, 2), 'utf8');

    console.log('✅ Exportação gravada em', ARQUIVO_EXPORT);
    console.log(`   admins: ${admins.length} | mercados: ${mercados.length} | vínculos: ${vinculos.length}`);
    console.log(`   categorias: ${categorias.length} | produtos: ${produtos.length} | catálogo: ${catalogo.length}`);

    if (!admins.length || !mercados.length || !produtos.length) {
      throw new Error('Exportação incompleta (admins/mercados/produtos zerados) — abortando.');
    }
    return dados;
  } finally {
    await pool.end();
  }
}

// ---------------------------------------------------------------- APLICAR
async function inserir(client, tabela, linhas, converter) {
  if (!linhas.length) return 0;
  const colunas = [...new Set(linhas.flatMap((l) => Object.keys(l)))];
  let total = 0;

  for (let i = 0; i < linhas.length; i += 50) {
    const lote = linhas.slice(i, i + 50);
    const valores = [];
    const marcas = lote.map((linha) => {
      const celulas = colunas.map((coluna) => {
        let v = linha[coluna];
        if (v === undefined) v = null;
        v = converter(v);
        valores.push(v);
        return `$${valores.length}`;
      });
      return `(${celulas.join(', ')})`;
    });

    await client.query(
      `INSERT INTO ${tabela} (${colunas.join(', ')}) VALUES ${marcas.join(', ')} ON CONFLICT DO NOTHING`,
      valores,
    );
    total += lote.length;
  }
  return total;
}

async function aplicar(banco) {
  const dados = JSON.parse(fs.readFileSync(ARQUIVO_EXPORT, 'utf8'));
  const pool = new Pool({ connectionString: URL(banco) });
  const converter = banco === 'neon' ? reescreverUrl : (v) => v;

  try {
    // senha vigente neste banco (por e-mail) — nunca troca a senha de quem já está aqui
    const senhasAtuais = new Map(
      (await pool.query(`SELECT email, senha FROM usuarios`)).rows.map((u) => [u.email, u.senha]),
    );
    const usuarios = dados.admins.map((u) =>
      senhasAtuais.has(u.email) ? { ...u, senha: senhasAtuais.get(u.email) } : u,
    );

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const tabelas = (await client.query(`
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
          AND table_name <> ALL($1::text[])
        ORDER BY table_name
      `, [TABELAS_PROTEGIDAS])).rows.map((r) => r.table_name);

      await client.query(`TRUNCATE TABLE ${tabelas.map((t) => `public.${t}`).join(', ')} RESTART IDENTITY`);
      await client.query('DELETE FROM usuarios');

      const contagem = {
        usuarios: await inserir(client, 'usuarios', usuarios, converter),
        mercados: await inserir(client, 'mercados', dados.mercados, converter),
        usuarios_mercados: await inserir(client, 'usuarios_mercados', dados.vinculos, converter),
        categorias: await inserir(client, 'categorias', dados.categorias, converter),
        produtos: await inserir(client, 'produtos', dados.produtos, converter),
        produtos_catalogo: await inserir(client, 'produtos_catalogo', dados.catalogo, converter),
      };

      for (const [tabela, coluna] of SEQUENCIAS) {
        await client.query(`
          SELECT setval(
            pg_get_serial_sequence('${tabela}', '${coluna}'),
            COALESCE((SELECT MAX(${coluna}) FROM ${tabela}), 1),
            (SELECT MAX(${coluna}) FROM ${tabela}) IS NOT NULL
          )
        `);
      }

      await client.query('COMMIT');
      console.log(`\n✅ ${banco.toUpperCase()} aplicado:`);
      for (const [tabela, n] of Object.entries(contagem)) console.log(`   ${tabela}: ${n}`);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}

// ---------------------------------------------------------------- VERIFICAR
async function verificar() {
  for (const banco of ['local', 'neon']) {
    const pool = new Pool({ connectionString: URL(banco) });
    try {
      const contar = async (tabela) => {
        try {
          const r = await pool.query(`SELECT count(*)::int AS n FROM ${tabela}`);
          return r.rows[0].n;
        } catch {
          return '-';
        }
      };

      console.log(`\n===== ${banco.toUpperCase()} =====`);
      for (const t of ['usuarios', 'mercados', 'usuarios_mercados', 'categorias', 'produtos', 'produtos_catalogo']) {
        console.log(`  ${t}: ${await contar(t)}`);
      }

      const admins = await pool.query(`
        SELECT id_usuario, nome, email FROM usuarios WHERE is_admin = TRUE ORDER BY id_usuario
      `);
      console.log('  administradores:');
      for (const a of admins.rows) console.log(`    [${a.id_usuario}] ${a.nome} <${a.email}>`);

      const lojas = await pool.query(`
        SELECT DISTINCT m.id_mercado, m.nome FROM mercados m
        JOIN usuarios_mercados um ON um.id_mercado = m.id_mercado
        JOIN usuarios u ON u.id_usuario = um.id_usuario AND u.is_admin = TRUE
        WHERE um.papel IN ('dono','admin') ORDER BY 1
      `);
      console.log('  mercados dos admins: ' + lojas.rows.map((m) => `${m.id_mercado}:${m.nome}`).join(' | '));

      const naoAdmin = await pool.query(`SELECT count(*)::int AS n FROM usuarios WHERE is_admin IS NOT TRUE`);
      console.log(`  usuários comuns restantes: ${naoAdmin.rows[0].n}`);
    } finally {
      await pool.end();
    }
  }
}

// ---------------------------------------------------------------- CLI
(async () => {
  const banco = arg('db');
  const confirmar = arg('confirmar');

  if (flag('exportar')) {
    await exportar();
  } else if (flag('aplicar')) {
    if (!['local', 'neon'].includes(banco)) {
      console.error('❌ Informe o banco: --db=local ou --db=neon');
      process.exit(1);
    }
    if (confirmar !== banco) {
      console.error(`❌ Confirme com --confirmar=${banco}`);
      process.exit(1);
    }
    await aplicar(banco);
  } else if (flag('verificar')) {
    await verificar();
  } else {
    console.log('Uso: --exportar | --db=<local|neon> --aplicar --confirmar=<banco> | --verificar');
    process.exit(1);
  }
  process.exit(0);
})().catch((err) => {
  console.error('❌ Erro:', err.message);
  process.exit(1);
});
