//  017 — Catálogo de produtos genéricos prontos

module.exports = {
  id: '017_produtos_catalogo',
  descricao: 'Catálogo de produtos genéricos prontos (fotos + descrição reutilizáveis)',

  async up(sql) {
    await sql`
      CREATE TABLE IF NOT EXISTS produtos_catalogo (
        id              SERIAL PRIMARY KEY,
        nome            TEXT NOT NULL,
        descricao       TEXT NOT NULL DEFAULT '',
        imagens         TEXT[] NOT NULL DEFAULT '{}',
        preco_sugerido  NUMERIC(10,2) NOT NULL DEFAULT 0,
        tipo_loja       TEXT NOT NULL DEFAULT 'geral',
        ativo           BOOLEAN NOT NULL DEFAULT TRUE,
        criado_em       TIMESTAMP NOT NULL DEFAULT NOW(),
        atualizado_em   TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS idx_produtos_catalogo_tipo
        ON produtos_catalogo (tipo_loja)
    `;
  },
};
