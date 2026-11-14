require('dotenv').config();
const { Pool } = require('pg');

let sqlInstance = null;

const escolherBanco = () => {
  const arg = process.argv.find((a) => a.startsWith('--db='));
  const valor = (arg ? arg.split('=')[1] : process.env.DB_PROVIDER || '').toLowerCase();

  if (['local', 'postgres', 'postgresql'].includes(valor)) return 'local';
  if (['neon', 'nuvem', 'cloud'].includes(valor)) return 'neon';

  if (process.env.RENDER) return 'neon';
  return 'local';
};

function montarQuery(strings, values) {
  return strings.reduce(
    (acc, part, i) => acc + part + (i < values.length ? `$${i + 1}` : ''),
    '',
  );
}

function criarExecutavel(pool) {
  const executar = async (strings, ...values) => {
    const query = montarQuery(strings, values);
    const result = await pool.query(query, values);
    return result.rows;
  };

  executar.transaction = async (fn) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const tx = async (strings, ...values) => {
        const query = montarQuery(strings, values);
        const result = await client.query(query, values);
        return result.rows;
      };
      const resultado = await fn(tx);
      await client.query('COMMIT');
      return resultado;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  };

  return executar;
}

async function conectarNeon() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL_NEON,
  });

  await pool.query('SELECT 1');
  return criarExecutavel(pool);
}

async function conectarLocal() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL_LOCAL,
  });

  await pool.query('SELECT 1');
  return criarExecutavel(pool);
}

async function conectar() {
  if (sqlInstance) return sqlInstance;

  const banco = escolherBanco();

  try {
    sqlInstance = banco === 'neon'
      ? await conectarNeon()
      : await conectarLocal();
    return sqlInstance;
  } catch (err) {
    const origem = banco === 'neon' ? 'Neon' : 'PostgreSQL local';
    console.error(`Falha ao conectar ao ${origem}:`, err.message);
    throw new Error(
      banco === 'neon'
        ? 'Falha na conexão com o Neon (verifique DATABASE_URL_NEON e a rede)'
        : 'Falha na conexão com o PostgreSQL local (verifique DATABASE_URL_LOCAL e se o serviço está no ar)'
    );
  }
}

module.exports = { conectar };