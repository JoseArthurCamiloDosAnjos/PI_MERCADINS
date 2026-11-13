//  007 — Endereço de entrega informado no carrinho

module.exports = {
  id: '007_endereco_entrega_pedido',
  descricao: 'Endereço de entrega informado pelo cliente no carrinho',

  async up(sql) {
    await sql`
      ALTER TABLE historico_compras
        ADD COLUMN IF NOT EXISTS endereco_entrega TEXT DEFAULT ''
    `;
  },
};
