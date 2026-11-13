//  010 — Suspensão de mercados por assinatura vencida

module.exports = {
  id: '010_suspenso_assinaturas',
  descricao: 'Suspensao de mercados por assinatura vencida (suspenso_em)',

  async up(sql) {
    await sql`
      ALTER TABLE mercados ADD COLUMN IF NOT EXISTS suspenso_em TIMESTAMP DEFAULT NULL
    `;
  },
};
