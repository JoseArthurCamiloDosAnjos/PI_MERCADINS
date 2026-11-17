//  Preenche latitude/longitude dos mercados que ainda não têm coordenadas.
//  Uso: node scripts/geocodificar-mercados.js
require('dotenv').config();
const { conectar } = require('../src/db/neon');
const { geocodificar } = require('../src/services/geocoding');

async function main() {
  const sql = await conectar();

  const pendentes = await sql`
    SELECT id_mercado, nome, rua, bairro, cidade, estado, cep
    FROM mercados
    WHERE latitude IS NULL OR longitude IS NULL
    ORDER BY id_mercado
  `;

  console.log(`Mercados sem coordenadas: ${pendentes.length}`);

  let ok = 0;
  for (const m of pendentes) {
    const coords = await geocodificar(m);
    if (!coords) {
      console.log(`  ✗ ${m.nome} — endereço não geocodificável`);
      continue;
    }
    await sql`
      UPDATE mercados SET latitude = ${coords.lat}, longitude = ${coords.lng}
      WHERE id_mercado = ${m.id_mercado}
    `;
    ok++;
    console.log(`  ✓ ${m.nome} — ${coords.lat}, ${coords.lng}`);
    await new Promise((r) => setTimeout(r, 1100)); // Nominatim: 1 req/s
  }

  console.log(`Concluído: ${ok}/${pendentes.length} geocodificados.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
