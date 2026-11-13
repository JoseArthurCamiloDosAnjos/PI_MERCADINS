
module.exports = {
  id: '022_colunas_neon',
  descricao: 'Versiona mercados.categorias, mercados.custos_fixos e produtos.custo (existiam só no Neon)',

  async up(sql) {
    await sql`ALTER TABLE mercados ADD COLUMN IF NOT EXISTS categorias TEXT[]`;
    await sql`ALTER TABLE mercados ADD COLUMN IF NOT EXISTS custos_fixos NUMERIC(10,2) NOT NULL DEFAULT 0`;
    await sql`ALTER TABLE produtos ADD COLUMN IF NOT EXISTS custo NUMERIC(10,2) NOT NULL DEFAULT 0`;
  },
};
