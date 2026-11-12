// Migração 022 — colunas que existiam só no Neon (criadas fora do versionamento)
//
// O banco de produção ganhou 3 colunas sem passar por migration, então bancos
// novos/locais ficavam sem elas e o INSERT de mercado dava
//   "coluna "categorias" da relação "mercados" não existe".
//
// • mercados.categorias  → chips/categorias escolhidas no cadastro da loja
// • mercados.custos_fixos → custo fixo mensal usado no cálculo do pedido
// • produtos.custo        → custo do produto (usado junto com o preço)
//
// Idempotente: ADD COLUMN IF NOT EXISTS — pode rodar de novo sem quebrar nada.
// Com a 022 registrada, o schema local passa a bater com o do Neon.

module.exports = {
  id: '022_colunas_neon',
  descricao: 'Versiona mercados.categorias, mercados.custos_fixos e produtos.custo (existiam só no Neon)',

  async up(sql) {
    await sql`ALTER TABLE mercados ADD COLUMN IF NOT EXISTS categorias TEXT[]`;
    await sql`ALTER TABLE mercados ADD COLUMN IF NOT EXISTS custos_fixos NUMERIC(10,2) NOT NULL DEFAULT 0`;
    await sql`ALTER TABLE produtos ADD COLUMN IF NOT EXISTS custo NUMERIC(10,2) NOT NULL DEFAULT 0`;
  },
};
