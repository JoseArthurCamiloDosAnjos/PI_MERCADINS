//  014 — Cupons com escopo por categoria de produto

module.exports = {
  id: '014_cupom_categorias',
  descricao: 'Tabela de ligacao cupom x categoria de produto',

  async up(sql) {
    await sql`
      CREATE TABLE IF NOT EXISTS cupom_categorias (
        id_cupom    INTEGER NOT NULL REFERENCES cupons(id) ON DELETE CASCADE,
        id_categoria INTEGER NOT NULL REFERENCES categorias(id_categoria) ON DELETE CASCADE,
        PRIMARY KEY (id_cupom, id_categoria)
      )
    `;
  },
};
