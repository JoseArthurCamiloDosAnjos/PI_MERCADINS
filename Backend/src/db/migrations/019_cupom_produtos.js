//  019 — Cupons com escopo por produto específico

module.exports = {
  id: '019_cupom_produtos',
  descricao: 'Tabela de ligacao cupom x produto especifico',

  async up(sql) {
    await sql`
      CREATE TABLE IF NOT EXISTS cupom_produtos (
        id_cupom   INTEGER NOT NULL REFERENCES cupons(id) ON DELETE CASCADE,
        id_produto INTEGER NOT NULL REFERENCES produtos(id_produto) ON DELETE CASCADE,
        PRIMARY KEY (id_cupom, id_produto)
      )
    `;
  },
};
