//  015 — Recebimento direto ao vendedor (Asaas Split)

module.exports = {
  id: '015_split_vendedor',
  descricao: 'Recebimento direto ao vendedor via Asaas Split (wallet + repasses)',

  async up(sql) {
    await sql`
      ALTER TABLE mercados ADD COLUMN IF NOT EXISTS asaas_wallet_id TEXT
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS repasses (
        id               SERIAL PRIMARY KEY,
        id_pedido        INTEGER NOT NULL,
        asaas_payment_id TEXT,
        asaas_split_id   TEXT UNIQUE,
        wallet_id        TEXT,
        valor            NUMERIC(10,2) NOT NULL DEFAULT 0,
        status           TEXT NOT NULL DEFAULT 'PENDENTE',
        motivo           TEXT NOT NULL DEFAULT '',
        criado_em        TIMESTAMP NOT NULL DEFAULT NOW(),
        atualizado_em    TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS idx_repasses_pedido ON repasses (id_pedido)
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_repasses_payment ON repasses (asaas_payment_id)
    `;
  },
};
