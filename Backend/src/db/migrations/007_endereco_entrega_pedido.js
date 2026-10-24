// ─────────────────────────────────────────────────────────────────────────────
//  007 — Endereço de entrega informado no carrinho
//
//  Quando o cliente escolhe ENTREGA, o carrinho passa a pedir rua, número,
//  bairro, CEP, cidade e complemento. O endereço vai junto do pedido em um
//  texto único ("Rua X, nº 123 - Bairro - CEP 12345-678 - Cidade"), assim a
//  loja vê onde entregar na tela de pedidos e no e-mail de aviso.
//  Na retirada no balcão a coluna fica vazia.
// ─────────────────────────────────────────────────────────────────────────────

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
