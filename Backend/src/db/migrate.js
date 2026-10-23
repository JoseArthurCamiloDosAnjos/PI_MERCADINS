// ─────────────────────────────────────────────────────────────────────────────
//  Migrações do banco de dados — executor versionado
//
//  Cada alteração de estrutura vive em um arquivo dentro de src/db/migrations,
//  numerado na ordem em que foi criado (001_, 002_, 003_...). Na primeira vez
//  que roda, o executor aplica todas na sequência; depois, só as que ainda não
//  foram registradas. O que já foi aplicado fica guardado na tabela
//  "schema_migrations", então é seguro rodar de novo a qualquer momento.
//
//  Como criar uma migração nova:
//    1) copie a estrutura de um arquivo existente (module.exports = { id, descricao, up });
//    2) use o próximo número (ex.: 004_minha_mudanca.js);
//    3) escreva apenas comandos idempotentes (IF NOT EXISTS) para poder
//       reaplicar sem risco em outros ambientes;
//    4) rode:  npm run migrate
// ─────────────────────────────────────────────────────────────────────────────
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { conectar } = require('./neon');

const PASTA_MIGRACOES = path.join(__dirname, 'migrations');

async function migrate() {
  const sql = await conectar();

  // Registro das migrações já aplicadas nesta base
  await sql`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      descricao TEXT DEFAULT '',
      aplicado_em TIMESTAMP DEFAULT NOW()
    )
  `;

  const aplicadas = new Set(
    (await sql`SELECT id FROM schema_migrations`).map((linha) => linha.id)
  );

  const arquivos = fs
    .readdirSync(PASTA_MIGRACOES)
    .filter((arquivo) => arquivo.endsWith('.js'))
    .sort(); // 001_..., 002_..., ... (ordem numérica pelo nome)

  let aplicadasAgora = 0;
  for (const arquivo of arquivos) {
    const id = arquivo.replace(/\.js$/, '');
    if (aplicadas.has(id)) continue;

    const { descricao, up } = require(path.join(PASTA_MIGRACOES, arquivo));
    if (typeof up !== 'function') {
      throw new Error(`Migração "${arquivo}" não exporta a função up(sql).`);
    }

    console.log(`Aplicando migração ${id} — ${descricao || 'sem descrição'}`);
    await up(sql);
    await sql`
      INSERT INTO schema_migrations (id, descricao)
      VALUES (${id}, ${descricao || ''})
      ON CONFLICT (id) DO NOTHING
    `;
    aplicadasAgora += 1;
  }

  console.log(
    aplicadasAgora === 0
      ? 'Banco de dados atualizado — nenhuma migração pendente.'
      : `Migrações aplicadas: ${aplicadasAgora}.`
  );
}

migrate().catch((err) => {
  console.error('Erro na migração:', err.message);
  process.exit(1);
});
