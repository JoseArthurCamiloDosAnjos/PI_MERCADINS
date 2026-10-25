// ─────────────────────────────────────────────────────────────────────────────
//  010 — Suspensão de mercados por assinatura vencida
//
//  Quando a vigência da assinatura acaba (proximo_pagamento + carência) e o
//  cliente não renova, o mercado passa para o status 'suspenso': ele sai das
//  buscas, vitrines e do sitemap (tudo filtra status = 'ativo'), mas continua
//  existindo no banco e no painel do vendedor até o pagamento regularizar.
//
//  'suspenso' é diferente de 'bloqueado' (bloqueio manual do admin): assim a
//  reativação automática só devolve lojas suspensas por cobrança e nunca
//  desbloqueia uma loja banida.
//
//  suspenso_em registra QUANDO a suspensão aconteceu (exibido ao vendedor e
//  ao admin como motivo/data).
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  id: '010_suspenso_assinaturas',
  descricao: 'Suspensao de mercados por assinatura vencida (suspenso_em)',

  async up(sql) {
    await sql`
      ALTER TABLE mercados ADD COLUMN IF NOT EXISTS suspenso_em TIMESTAMP DEFAULT NULL
    `;
  },
};
