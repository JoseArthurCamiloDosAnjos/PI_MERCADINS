
module.exports = {
  id: '025_comentarios_edicao',
  descricao: 'Marca comentário editado pelo autor (avaliações de loja e de produto)',
  up: async (sql) => {
    await sql`
      ALTER TABLE avaliacoes
      ADD COLUMN IF NOT EXISTS editado BOOLEAN NOT NULL DEFAULT FALSE
    `;
    await sql`
      ALTER TABLE avaliacoes_produtos
      ADD COLUMN IF NOT EXISTS editado BOOLEAN NOT NULL DEFAULT FALSE
    `;
  },
};
