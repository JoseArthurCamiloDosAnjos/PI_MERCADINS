// ─────────────────────────────────────────────────────────────────────────────
//  019 — Cupons com escopo por produto específico
//
//  Além das categorias (014), o vendedor pode escolher um ou mais produtos
//  específicos em que o cupom vale (ex.: "só no Arroz 5kg"). O desconto vale
//  para um item se ele estiver em UMA das categorias escolhidas OU for um
//  dos produtos escolhidos (união dos dois escopos).
//
//  Sem nenhuma linha nesta tabela E sem categorias, o cupom continua valendo
//  para o pedido inteiro — cupons antigos não mudam de comportamento.
//
//  Ao apagar o cupom ou o produto, a linha correspondente sai junto
//  (ON DELETE CASCADE).
// ─────────────────────────────────────────────────────────────────────────────

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
