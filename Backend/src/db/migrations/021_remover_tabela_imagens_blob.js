
module.exports = {
  id: '021_remover_tabela_imagens_blob',
  descricao: 'Remove a tabela legada de imagens em blob (imagens passam a ser arquivo + caminho)',
  up: async (sql) => {
    await sql`DROP TABLE IF EXISTS imagens`;
  },
};
