//  023 — Idempotência do webhook do Asaas
//
//  Justificativa (aditiva, não altera regras de split nem tabelas financeiras):
//  o Asaas entrega eventos no modelo "at least once" — o mesmo `id` de evento
//  pode chegar mais de uma vez. A deduplicação durável exige restrição UNIQUE
//  (memória não sobrevive a restarts do Render). Guardas de estado atuais
//  (UPDATE ... RETURNING, asaas_payment_id UNIQUE) são a 2ª camada; esta
//  tabela é o gate de 1ª camada para não reexecutar a regra de negócio.

module.exports = {
  id: '023_asaas_eventos',
  descricao: 'Idempotência do webhook Asaas (event id UNIQUE + status PENDING/DONE)',

  async up(sql) {
    await sql`
      CREATE TABLE IF NOT EXISTS asaas_eventos (
        id              SERIAL PRIMARY KEY,
        asaas_event_id  TEXT UNIQUE NOT NULL,
        evento          TEXT NOT NULL DEFAULT '',
        payload         JSONB NOT NULL DEFAULT '{}'::jsonb,
        status          TEXT NOT NULL DEFAULT 'PENDING'
                        CHECK (status IN ('PENDING', 'DONE')),
        criado_em       TIMESTAMP NOT NULL DEFAULT NOW(),
        atualizado_em   TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `;
  },
};
