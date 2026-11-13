require('dotenv').config();
const { neon } = require('@neondatabase/serverless');
const { Pool } = require('pg');

let sqlInstance = null;

const escolherBanco = () => {
  const arg = process.argv.find((a) => a.startsWith('--db='));
  const valor = (arg ? arg.split('=')[1] : process.env.DB_PROVIDER || '').toLowerCase();

  if (['local', 'postgres', 'postgresql'].includes(valor)) return 'local';
  if (['neon', 'nuvem', 'cloud'].includes(valor)) return 'neon';
  return 'auto';
};

async function conectarNeon() {
  const neonSql = neon(process.env.DATABASE_URL_NEON);
  await neonSql`SELECT 1`;
  console.log('Conectado ao Neon');
  return neonSql;
}

async function conectarLocal() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL_LOCAL,
  });

  await pool.query('SELECT 1');
  console.log('Conectado ao PostgreSQL local');

  return async (strings, ...values) => {
    const query = strings.reduce(
      (acc, part, i) => acc + part + (i < values.length ? `$${i + 1}` : ''),
      '',
    );
    const result = await pool.query(query, values);
    return result.rows;
  };
}

async function conectar() {
  if (sqlInstance) return sqlInstance;

  const banco = escolherBanco();
  console.log(`Banco escolhido: ${banco.toUpperCase()}`);

  if (banco === 'neon') {
    sqlInstance = await conectarNeon();
    return sqlInstance;
  }

  if (banco === 'local') {
    sqlInstance = await conectarLocal();
    return sqlInstance;
  }

  try {
    sqlInstance = await conectarNeon();
    return sqlInstance;
  } catch (err) {
    console.warn('Neon indisponível, tentando PostgreSQL local...', err.message);
  }

  try {
    sqlInstance = await conectarLocal();
    return sqlInstance;
  } catch (err) {
    console.error('Falha ao conectar ao PostgreSQL local:', err.message);
    throw new Error('Nenhuma conexão de banco de dados disponível');
  }
}

module.exports = { conectar };
