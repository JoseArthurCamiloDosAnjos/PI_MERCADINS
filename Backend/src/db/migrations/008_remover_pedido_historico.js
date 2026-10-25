// ─────────────────────────────────────────────────────────────────────────────
//  008 — Remover um pedido do histórico do cliente
//
//  O cliente pode apagar um registro da própria lista "Meus pedidos".
//  A coluna removido_cliente apenas esconde o pedido da tela do cliente:
//  o registro continua no banco, então a loja continua vendo o pedido no
//  painel dela e nenhum dado de venda é perdido.
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  id: '008_remover_pedido_historico',
  descricao: 'Cliente pode esconder um pedido do proprio historico',

  async up(sql) {
    await sql`
      ALTER TABLE historico_compras
        ADD COLUMN IF NOT EXISTS removido_cliente BOOLEAN NOT NULL DEFAULT FALSE
    `;
  },
};
