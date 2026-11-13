
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
