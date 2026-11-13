//  012 — Complemento e data de criação na tabela de endereços

module.exports = {
  id: '012_enderecos_cliente_campos',
  descricao: 'Complemento e criado_em na tabela de enderecos do cliente',

  async up(sql) {
    await sql`
      ALTER TABLE enderecos_usuario
        ADD COLUMN IF NOT EXISTS complemento TEXT DEFAULT ''
    `;

    await sql`
      ALTER TABLE enderecos_usuario
        ADD COLUMN IF NOT EXISTS criado_em TIMESTAMP DEFAULT NOW()
    `;
  },
};
