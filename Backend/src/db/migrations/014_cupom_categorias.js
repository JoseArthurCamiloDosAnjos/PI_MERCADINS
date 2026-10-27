// ─────────────────────────────────────────────────────────────────────────────
//  014 — Cupons com escopo por categoria de produto
//
//  O vendedor pode dizer em quais categorias de produtos o cupom vale (ex.:
//  "só em Hortifruti e Açougue"). Sem nenhuma linha nesta tabela, o cupom
//  continua valendo para o pedido inteiro — igual era antes, então nenhum
//  cupom antigo muda de comportamento.
//
//  Ao apagar o cupom ou a categoria, a linha correspondente sai junto
//  (ON DELETE CASCADE).
// ─────────────────────────────────────────────────────────────────────────────

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
