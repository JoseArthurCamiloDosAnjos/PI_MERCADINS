// Migração 018 — notificações: marcação de leitura
//
// • Adiciona a coluna "lida" à tabela notificacoes. Quando é NULL/FALSE o
//   aviso ainda não foi aberto pela pessoa; TRUE significa que ela já viu.
// • Cria um índice composto para a listagem "não lidas primeiro" ficar rápida.
//
// Idempotente: pode rodar de novo sem quebrar nada.

module.exports = {
  id: '018_notificacoes_lida',
  descricao: 'Coluna de leitura nas notificações',
  up: async (sql) => {
    await sql`
      ALTER TABLE notificacoes
      ADD COLUMN IF NOT EXISTS lida BOOLEAN NOT NULL DEFAULT FALSE
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_notificacoes_usuario_lida
      ON notificacoes (id_usuario, lida, id DESC)
    `;
  },
};
