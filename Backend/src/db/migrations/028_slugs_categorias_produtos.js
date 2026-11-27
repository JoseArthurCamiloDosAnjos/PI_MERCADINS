module.exports = {
  id: '028_slugs_categorias_produtos',
  descricao: 'Adiciona coluna slug em categorias e produtos para URLs legíveis',
  up: async (sql) => {
    // 1. Adicionar coluna slug nas categorias
    await sql`ALTER TABLE categorias ADD COLUMN IF NOT EXISTS slug TEXT`;

    // 2. Adicionar coluna slug nos produtos
    await sql`ALTER TABLE produtos ADD COLUMN IF NOT EXISTS slug TEXT`;

    // 3. Índices únicos compostos (slug único por mercado para categorias, por categoria para produtos)
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS uq_categorias_slug_mercado ON categorias (slug, id_mercado) WHERE slug IS NOT NULL`;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS uq_produtos_slug_categoria ON produtos (slug, id_categoria) WHERE slug IS NOT NULL`;

    // 4. Função para gerar slug base (mesma lógica dos mercados)
    await sql`
      CREATE OR REPLACE FUNCTION gerar_slug_base(txt TEXT)
      RETURNS TEXT
      LANGUAGE sql
      IMMUTABLE
      AS $$
        SELECT lower(regexp_replace(
          translate(
            txt,
            'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
            'aaaaaeeeeiiiiooooouuuucnaaaaaeeeeiiiiooooouuuucn'
          ),
          '[^a-z0-9]+', '-', 'g'
        ))
      $$;
    `;

    // 5. Popular slugs existentes nas categorias
    await sql`
      UPDATE categorias c
      SET slug = sub.slug_gerado
      FROM (
        SELECT
          c2.id_categoria,
          CASE
            WHEN COUNT(*) OVER (PARTITION BY c2.id_mercado, base_slug) = 1
            THEN base_slug
            ELSE base_slug || '-' || ROW_NUMBER() OVER (PARTITION BY c2.id_mercado, base_slug ORDER BY c2.id_categoria)
          END AS slug_gerado
        FROM (
          SELECT
            id_categoria,
            id_mercado,
            gerar_slug_base(nome) AS base_slug
          FROM categorias
          WHERE slug IS NULL
        ) c2
      ) sub
      WHERE c.id_categoria = sub.id_categoria
    `;

    // 6. Popular slugs existentes nos produtos
    await sql`
      UPDATE produtos p
      SET slug = sub.slug_gerado
      FROM (
        SELECT
          p2.id_produto,
          CASE
            WHEN COUNT(*) OVER (PARTITION BY p2.id_categoria, base_slug) = 1
            THEN base_slug
            ELSE base_slug || '-' || ROW_NUMBER() OVER (PARTITION BY p2.id_categoria, base_slug ORDER BY p2.id_produto)
          END AS slug_gerado
        FROM (
          SELECT
            id_produto,
            id_categoria,
            gerar_slug_base(nome) AS base_slug
          FROM produtos
          WHERE slug IS NULL
        ) p2
      ) sub
      WHERE p.id_produto = sub.id_produto
    `;
  },
  down: async (sql) => {
    await sql`DROP INDEX IF EXISTS uq_categorias_slug_mercado`;
    await sql`DROP INDEX IF EXISTS uq_produtos_slug_categoria`;
    await sql`ALTER TABLE categorias DROP COLUMN IF EXISTS slug`;
    await sql`ALTER TABLE produtos DROP COLUMN IF EXISTS slug`;
    await sql`DROP FUNCTION IF EXISTS gerar_slug_base(TEXT)`;
  },
};