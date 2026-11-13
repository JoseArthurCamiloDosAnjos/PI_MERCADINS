
module.exports = {
  id: '002_entrega_cupons_agendamento',
  descricao: 'Entrega/retirada com taxa e mínimo, cupons de desconto, agendamento e ids de produtos no pedido',
  up: async (sql) => {
    // ── B2: como o mercado entrega ──────────────────────────────────────────
    await sql`ALTER TABLE mercados ADD COLUMN IF NOT EXISTS taxa_entrega NUMERIC(10,2) DEFAULT 0`;
    await sql`ALTER TABLE mercados ADD COLUMN IF NOT EXISTS pedido_minimo NUMERIC(10,2) DEFAULT 0`;
    await sql`ALTER TABLE mercados ADD COLUMN IF NOT EXISTS oferece_entrega BOOLEAN DEFAULT TRUE`;
    await sql`ALTER TABLE mercados ADD COLUMN IF NOT EXISTS oferece_retirada BOOLEAN DEFAULT TRUE`;

    // ── B2/B3/B10/B8: o que cada pedido carrega a mais ─────────────────────
    await sql`ALTER TABLE historico_compras ADD COLUMN IF NOT EXISTS tipo_entrega TEXT DEFAULT 'entrega'`;
    await sql`ALTER TABLE historico_compras ADD COLUMN IF NOT EXISTS taxa_entrega NUMERIC(10,2) DEFAULT 0`;
    await sql`ALTER TABLE historico_compras ADD COLUMN IF NOT EXISTS agendamento TEXT DEFAULT ''`;
    await sql`ALTER TABLE historico_compras ADD COLUMN IF NOT EXISTS cupom_codigo TEXT DEFAULT ''`;
    await sql`ALTER TABLE historico_compras ADD COLUMN IF NOT EXISTS desconto NUMERIC(10,2) DEFAULT 0`;
    await sql`ALTER TABLE historico_compras ADD COLUMN IF NOT EXISTS produto_ids TEXT DEFAULT ''`;

    // ── B3: cupons de desconto (cada mercado cria os seus) ─────────────────
    await sql`
      CREATE TABLE IF NOT EXISTS cupons (
        id SERIAL PRIMARY KEY,
        id_mercado INTEGER NOT NULL REFERENCES mercados(id_mercado) ON DELETE CASCADE,
        codigo TEXT NOT NULL,
        tipo TEXT NOT NULL CHECK (tipo IN ('percentual', 'valor')),
        valor NUMERIC(10,2) NOT NULL,
        min_pedido NUMERIC(10,2) DEFAULT 0,
        max_usos INTEGER,
        usos INTEGER DEFAULT 0,
        validade DATE,
        ativo BOOLEAN DEFAULT TRUE,
        criado_em TIMESTAMP DEFAULT NOW(),
        UNIQUE(id_mercado, codigo)
      )
    `;
  },
};
