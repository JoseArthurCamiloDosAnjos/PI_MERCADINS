// Migração 003 — avaliação de produto com foto e selo "compra verificada".
//   foto: URL da foto que o cliente opcionalmente anexou à avaliação
//   verificada: true quando o cliente já comprou este produto no mercado
//               (calculado no backend no momento de gravar a avaliação)

module.exports = {
  id: '003_avaliacoes_foto_verificada',
  descricao: 'Avaliação de produto com foto opcional e selo de compra verificada',
  up: async (sql) => {
    await sql`ALTER TABLE avaliacoes_produtos ADD COLUMN IF NOT EXISTS foto TEXT DEFAULT ''`;
    await sql`ALTER TABLE avaliacoes_produtos ADD COLUMN IF NOT EXISTS verificada BOOLEAN DEFAULT FALSE`;
  },
};
