// Migração 020 — notificações passam a usar o canal 'email'
//
// A estrutura de WhatsApp/SMS foi removida: toda notificação agora é
// registrada (e quando cabe, enviada) por e-mail. Esta migração:
//   • muda o padrão da coluna "canal" de 'whatsapp' para 'email';
//   • converte o histórico antigo (whatsapp/sms) para 'email', para a tela
//     de Notificações mostrar tudo no novo canal.
//
// A coluna "telefone" permanece como legado (nullable) — nada a apagar.
// Idempotente: pode rodar de novo sem quebrar nada.

module.exports = {
  id: '020_notificacoes_email',
  descricao: 'Notificações passam a usar o canal e-mail (remove WhatsApp/SMS)',
  up: async (sql) => {
    await sql`ALTER TABLE notificacoes ALTER COLUMN canal SET DEFAULT 'email'`;
    await sql`UPDATE notificacoes SET canal = 'email' WHERE canal <> 'email'`;
  },
};
