require('dotenv').config();
const { conectar } = require('./neon');

async function migrate() {
  const sql = await conectar();

  await sql`
    CREATE TABLE IF NOT EXISTS favoritos (
      id SERIAL PRIMARY KEY,
      id_usuario INTEGER NOT NULL REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
      id_mercado INTEGER NOT NULL REFERENCES mercados(id_mercado) ON DELETE CASCADE,
      data_cadastro TIMESTAMP DEFAULT NOW(),
      UNIQUE(id_usuario, id_mercado)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS avaliacoes (
      id SERIAL PRIMARY KEY,
      id_usuario INTEGER NOT NULL REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
      id_mercado INTEGER NOT NULL REFERENCES mercados(id_mercado) ON DELETE CASCADE,
      nota INTEGER NOT NULL CHECK (nota >= 1 AND nota <= 5),
      texto TEXT DEFAULT '',
      data_cadastro TIMESTAMP DEFAULT NOW(),
      UNIQUE(id_usuario, id_mercado)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS historico_compras (
      id SERIAL PRIMARY KEY,
      id_usuario INTEGER NOT NULL REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
      id_mercado INTEGER NOT NULL REFERENCES mercados(id_mercado) ON DELETE CASCADE,
      produtos TEXT DEFAULT '',
      valor_total DECIMAL(10,2) DEFAULT 0,
      data_compra TIMESTAMP DEFAULT NOW(),
      status TEXT DEFAULT 'entregue'
    )
  `;

  // Adiciona colunas de paleta de cores se não existirem
  await sql`
    ALTER TABLE mercados ADD COLUMN IF NOT EXISTS paleta TEXT DEFAULT 'classico'
  `;
  await sql`
    ALTER TABLE mercados ADD COLUMN IF NOT EXISTS cor_base TEXT DEFAULT ''
  `;
  await sql`
    ALTER TABLE mercados ADD COLUMN IF NOT EXISTS cor_destaque TEXT DEFAULT ''
  `;

  // Adiciona coluna slug se não existir
  await sql`
    ALTER TABLE mercados ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE
  `;

  // Atualiza slug para mercados existentes
  await sql`
    UPDATE mercados SET slug = LOWER(REPLACE(REPLACE(REPLACE(nome, ' ', '-'), '.', ''), ',', ''))
    WHERE slug IS NULL
  `;

  // Adiciona coluna preco na tabela produtos se não existir
  await sql`
    ALTER TABLE produtos ADD COLUMN IF NOT EXISTS preco NUMERIC(10,2) DEFAULT 0
  `;

  // Adiciona coluna imagens (array de URLs) na tabela produtos se não existir
  await sql`
    ALTER TABLE produtos ADD COLUMN IF NOT EXISTS imagens TEXT[] DEFAULT '{}'
  `;

  console.log('✅ Tabelas criadas com sucesso!');
}

migrate().catch(err => {
  console.error('❌ Erro na migração:', err.message);
  process.exit(1);
});
