/**
 * Script para corrigir/regenerar todos os slugs dos mercados
 * 
 * Uso:
 *   node scripts/corrigir-slugs.js           # dry-run (mostra o que faria)
 *   node scripts/corrigir-slugs.js --apply   # aplica as mudanças
 *   node scripts/corrigir-slugs.js --apply --force  # força mesmo se slug já existir
 */

require('dotenv').config();
const { conectar } = require('../src/db/neon');

function gerarSlugBase(nome, cidade) {
  const base = `${nome} ${cidade || ''}`
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')  // remove acentos
    .replace(/[^a-z0-9]+/g, '-')      // substitui não-alfanuméricos por -
    .replace(/^-|-$/g, '');           // remove - do início/fim
  return base;
}

async function slugUnico(sql, nome, cidade, excetoId = null) {
  const base = gerarSlugBase(nome, cidade);
  let slug = base;
  let contador = 1;
  let existe = true;

  while (existe) {
    if (excetoId) {
      existe = await sql`
        SELECT 1 FROM mercados WHERE slug = ${slug} AND id_mercado != ${excetoId}
      `.then(r => r.length > 0);
    } else {
      existe = await sql`
        SELECT 1 FROM mercados WHERE slug = ${slug}
      `.then(r => r.length > 0);
    }

    if (existe) {
      contador++;
      slug = `${base}-${contador}`;
    }
  }
  return slug;
}

async function main() {
  const sql = await conectar();
  const apply = process.argv.includes('--apply');
  const force = process.argv.includes('--force');

  console.log('🔍 Buscando mercados...\n');

  const mercados = await sql`
    SELECT id_mercado, nome, cidade, slug
    FROM mercados
    ORDER BY id_mercado
  `;

  console.log(`📊 Total de mercados: ${mercados.length}\n`);

  let alteracoes = 0;
  let conflitos = 0;
  let jaCorretos = 0;

  for (const m of mercados) {
    const novoSlug = await slugUnico(sql, m.nome, m.cidade, m.id_mercado);
    const slugAtual = m.slug || '(vazio)';
    const igual = novoSlug === m.slug;

    if (igual) {
      jaCorretos++;
      if (!apply) {
        console.log(`✅ ${m.id_mercado} | "${m.nome}" (${m.cidade || 'sem cidade'})`);
        console.log(`   slug: "${slugAtual}" — já correto\n`);
      }
      continue;
    }

    // Verifica se o novo slug já existe em OUTRO mercado
    const conflito = await sql`
      SELECT id_mercado, nome FROM mercados WHERE slug = ${novoSlug} AND id_mercado != ${m.id_mercado}
    `;

    if (conflito.length > 0 && !force) {
      conflitos++;
      console.log(`⚠️  ${m.id_mercado} | "${m.nome}" (${m.cidade || 'sem cidade'})`);
      console.log(`   slug atual: "${slugAtual}"`);
      console.log(`   novo slug:  "${novoSlug}"`);
      console.log(`   ❌ CONFLITO: slug já usado por mercado #${conflito[0].id_mercado} "${conflito[0].nome}"`);
      console.log(`   Use --force para sobrescrever\n`);
      continue;
    }

    alteracoes++;

    if (apply) {
      await sql`
        UPDATE mercados SET slug = ${novoSlug} WHERE id_mercado = ${m.id_mercado}
      `;
      console.log(`🔄 ${m.id_mercado} | "${m.nome}" (${m.cidade || 'sem cidade'})`);
      console.log(`   "${slugAtual}" → "${novoSlug}" ✅ aplicado\n`);
    } else {
      console.log(`🔄 ${m.id_mercado} | "${m.nome}" (${m.cidade || 'sem cidade'})`);
      console.log(`   "${slugAtual}" → "${novoSlug}" ${conflito.length ? '⚠️ conflito (use --force)' : ''}\n`);
    }
  }

  console.log('─'.repeat(50));
  console.log(`📈 Resumo:`);
  console.log(`   ✅ Já corretos: ${jaCorretos}`);
  console.log(`   🔄 Para alterar: ${alteracoes}`);
  console.log(`   ⚠️ Conflitos: ${conflitos}`);
  console.log(`   📊 Total: ${mercados.length}`);

  if (!apply && (alteracoes > 0 || conflitos > 0)) {
    console.log('\n💡 Para aplicar: node scripts/corrigir-slugs.js --apply');
    if (conflitos > 0) {
      console.log('💡 Para forçar conflitos: node scripts/corrigir-slugs.js --apply --force');
    }
  } else if (apply) {
    console.log('\n✨ Migração concluída!');
  }
}

main()
  .catch(err => {
    console.error('❌ Erro:', err);
    process.exit(1);
  })
  .finally(() => {
    // dá tempo pro pool fechar se necessário
    setTimeout(() => process.exit(0), 100);
  });