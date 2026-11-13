
module.exports = {
  id: '020_notificacoes_email',
  descricao: 'Notificações passam a usar o canal e-mail (remove WhatsApp/SMS)',
  up: async (sql) => {
    await sql`ALTER TABLE notificacoes ALTER COLUMN canal SET DEFAULT 'email'`;
    await sql`UPDATE notificacoes SET canal = 'email' WHERE canal <> 'email'`;
  },
};
