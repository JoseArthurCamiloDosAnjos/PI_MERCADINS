// Migração 021 — remove a tabela "imagens" (armazenamento em blob)
//
// As imagens passaram a ser salvas como ARQUIVO na pasta local "imagens/"
// (PNG, JPG e WEBP) e só o CAMINHO/URL vai para o banco (produtos.imagem,
// produtos.imagens, mercados.foto_perfil/banner, usuarios.foto_perfil,
// avaliacoes_produtos.foto, produtos_catalogo.imagens).
//
// A tabela "imagens" (coluna "dados bytea") era de uma tentativa anterior de
// guardar os bytes no PostgreSQL: estava vazia e nenhum código a usa.
//
// Idempotente: pode rodar de novo sem quebrar nada.

module.exports = {
  id: '021_remover_tabela_imagens_blob',
  descricao: 'Remove a tabela legada de imagens em blob (imagens passam a ser arquivo + caminho)',
  up: async (sql) => {
    await sql`DROP TABLE IF EXISTS imagens`;
  },
};
