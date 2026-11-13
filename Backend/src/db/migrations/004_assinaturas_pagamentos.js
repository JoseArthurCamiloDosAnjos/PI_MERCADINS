//  004 — Assinaturas e pagamentos (planos Asaas)

module.exports = {
  id: '004_assinaturas_pagamentos',
  descricao: 'Assinaturas e pagamentos (planos Asaas) + colunas de endereço e slug',

  async up(sql) {
    await sql`ALTER TABLE mercados ADD COLUMN IF NOT EXISTS descricao TEXT DEFAULT ''`;
    await sql`ALTER TABLE mercados ADD COLUMN IF NOT EXISTS rua TEXT DEFAULT ''`;
    await sql`ALTER TABLE mercados ADD COLUMN IF NOT EXISTS bairro TEXT DEFAULT ''`;

    await sql`
      UPDATE mercados SET slug = LOWER(REPLACE(REPLACE(REPLACE(nome, ' ', '-'), '.', ''), ',', ''))
      WHERE slug IS NULL
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS assinaturas (
        id SERIAL PRIMARY KEY,
        id_usuario INTEGER NOT NULL REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
        id_mercado INTEGER REFERENCES mercados(id_mercado) ON DELETE SET NULL,
        codigo_plano TEXT NOT NULL,
        ciclo TEXT NOT NULL CHECK (ciclo IN ('MENSAL', 'ANUAL')),
        valor DECIMAL(10,2) NOT NULL,
        asaas_customer_id TEXT,
        asaas_subscription_id TEXT,
        status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'ativa', 'inadimplente', 'cancelada')),
        proximo_pagamento DATE,
        criada_em TIMESTAMP DEFAULT NOW(),
        atualizada_em TIMESTAMP DEFAULT NOW()
      )
    `;

    await sql`
      ALTER TABLE assinaturas ADD COLUMN IF NOT EXISTS dados_mercado JSONB
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS pagamentos (
        id SERIAL PRIMARY KEY,
        id_assinatura INTEGER NOT NULL REFERENCES assinaturas(id) ON DELETE CASCADE,
        asaas_payment_id TEXT UNIQUE,
        valor DECIMAL(10,2) NOT NULL,
        status TEXT DEFAULT 'PENDING',
        metodo TEXT DEFAULT '',
        vencimento DATE,
        pago_em TIMESTAMP,
        criado_em TIMESTAMP DEFAULT NOW()
      )
    `;
  },
};
