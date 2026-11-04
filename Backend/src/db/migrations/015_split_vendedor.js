// ─────────────────────────────────────────────────────────────────────────────
//  015 — Recebimento direto ao vendedor (Asaas Split)
//
//  O pagamento online de um pedido (Pix/cartão) pode ser dividido no momento
//  da cobrança: o valor líquido é transferido automaticamente para a conta
//  Asaas do lojista (walletId), em vez de ficar retido na conta da
//  plataforma. O vendedor cadastra o próprio walletId na edição do mercado.
//
//  • mercados.asaas_wallet_id — carteira Asaas do lojista (opcional; sem
//    wallet, o comportamento continua o antigo: dinheiro na plataforma).
//  • repasses — conciliação de cada repasse: uma linha por split do Asaas
//    (com asaas_split_id) ou uma linha "RETIDO_PLATAFORMA" quando o pedido
//    é online mas não houve split (sem wallet ou split recusado).
//
//  Status possíveis: PENDENTE, DONE (liquidado), CANCELLED, REFUSED,
//  DIVERGENCE_BLOCK e RETIDO_PLATAFORMA.
// ─────────────────────────────────────────────────────────────────────────────

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
