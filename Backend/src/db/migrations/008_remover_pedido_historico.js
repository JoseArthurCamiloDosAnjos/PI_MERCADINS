//  008 — Remover um pedido do histórico do cliente

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
