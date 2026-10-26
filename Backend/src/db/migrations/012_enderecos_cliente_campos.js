// ─────────────────────────────────────────────────────────────────────────────
//  012 — Complemento e data de criação na tabela de endereços
//
//  A tabela enderecos_usuario já existia no banco (criada fora deste projeto)
//  com a estrutura antiga: sem complemento e sem data de cadastro. Como ela
//  estava vazia, a migração só completa as colunas que o sistema usa hoje —
//  nada é apagado e nenhum dado é alterado.
// ─────────────────────────────────────────────────────────────────────────────

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
