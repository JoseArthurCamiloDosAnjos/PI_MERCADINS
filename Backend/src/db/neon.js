require('dotenv').config();
const { neon } = require('@neondatabase/serverless');
const { Pool } = require('pg');

let sqlInstance = null;

async function conectar() {
  if (sqlInstance) return sqlInstance;

  // 🌐 Tenta Neon primeiro
  try {
    const neonSql = neon(process.env.DATABASE_URL_NEON);
    await neonSql`SELECT 1`;
    console.log('✅ Conectado ao Neon');
    sqlInstance = neonSql;
    return sqlInstance;
  } catch (err) {
    console.warn('⚠️ Neon indisponível, tentando PostgreSQL local...', err.message);
  }

  // 🏠 Fallback para PostgreSQL local
  try {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL_LOCAL,
    });

    await pool.query('SELECT 1');
    console.log('✅ Conectado ao PostgreSQL local');

    // ✅ Wrapper correto com parâmetros preparados ($1, $2...)
    sqlInstance = async (strings, ...values) => {
      const query = strings.reduce((acc, part, i) =>
        acc + part + (i < values.length ? `$${i + 1}` : ''), '');

      const result = await pool.query(query, values);
      return result.rows;
    };

    return sqlInstance;
  } catch (err) {
    console.error('❌ Falha ao conectar ao PostgreSQL local:', err.message);
    throw new Error('Nenhuma conexão de banco de dados disponível');
  }
}

module.exports = { conectar };