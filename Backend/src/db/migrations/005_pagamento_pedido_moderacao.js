// ─────────────────────────────────────────────────────────────────────────────
//  005 — Pagamento do pedido e moderação de avaliações
//
//  • historico_compras ganha o pagamento do pedido (B3):
//      - forma_pagamento  — como o cliente escolheu pagar:
//        'presencial' (padrão, entrega/balcão), 'pix' ou 'cartao'
//      - asaas_payment_id — cobrança gerada no Asaas (para o webhook achar)
//      - itens_json       — foto dos itens [{id_produto, quantidade}] no momento
//        do pedido: é o que permite DEVOLVER o estoque se o pagamento falhar
//  • avaliacoes e avaliacoes_produtos ganham 'oculta' (B6): o vendedor pode
//    esconder uma avaliação do site sem apagá-la (pode exibir de novo).
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  id: '005_pagamento_pedido_moderacao',
  descricao: 'Pagamento do pedido (Pix/cartão) e moderação de avaliações',

  async up(sql) {
    // Forma de pagamento escolhida no carrinho
    await sql`
      ALTER TABLE historico_compras
        ADD COLUMN IF NOT EXISTS forma_pagamento TEXT NOT NULL DEFAULT 'presencial'
    `;
    // Cobrança no Asaas ligada a este pedido
    await sql`
      ALTER TABLE historico_compras
        ADD COLUMN IF NOT EXISTS asaas_payment_id TEXT
    `;
    // Cópia dos itens (id + quantidade) para devolver estoque em caso de falha
    await sql`
      ALTER TABLE historico_compras
        ADD COLUMN IF NOT EXISTS itens_json JSONB
    `;

    // Moderação de avaliações: visível no site (padrão) ou oculta pelo vendedor
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
