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