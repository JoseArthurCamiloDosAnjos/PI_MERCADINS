//  005 — Pagamento do pedido e moderação de avaliações

module.exports = {
  id: '005_pagamento_pedido_moderacao',
  descricao: 'Pagamento do pedido (Pix/cartão) e moderação de avaliações',

  async up(sql) {
    await sql`
      ALTER TABLE historico_compras
        ADD COLUMN IF NOT EXISTS forma_pagamento TEXT NOT NULL DEFAULT 'presencial'
    `;
    await sql`
      ALTER TABLE historico_compras
        ADD COLUMN IF NOT EXISTS asaas_payment_id TEXT
    `;
    await sql`
      ALTER TABLE historico_compras
        ADD COLUMN IF NOT EXISTS itens_json JSONB
    `;

    await sql`
      ALTER TABLE avaliacoes
        ADD COLUMN IF NOT EXISTS oculta BOOLEAN NOT NULL DEFAULT FALSE
    `;
    await sql`
      ALTER TABLE avaliacoes_produtos
        ADD COLUMN IF NOT EXISTS oculta BOOLEAN NOT NULL DEFAULT FALSE
    `;
  },
};
