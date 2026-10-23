// ─────────────────────────────────────────────────────────────────────────────
//  004 — Assinaturas e pagamentos (planos Asaas)
//
//  Traz para o sistema versionado as tabelas que existiam apenas no bloco
//  inline antigo do migrate.js:
//    • assinaturas — plano escolhido no cadastro, aguardando ou com pagamento
//      confirmado; dados_mercado guarda o cadastro da loja até o Asaas pagar
//      (o webhook cria o mercado com os dados validados).
//    • pagamentos — faturas de cada assinatura vindas do Asaas.
//  Também garante as colunas de endereço/descrição dos mercados para bases
//  novas, e atualiza o slug de mercados que ainda não tinham.
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  id: '004_assinaturas_pagamentos',
  descricao: 'Assinaturas e pagamentos (planos Asaas) + colunas de endereço e slug',

  async up(sql) {
    // Colunas de endereço/descrição dos mercados (garantia para bases novas)
    await sql`ALTER TABLE mercados ADD COLUMN IF NOT EXISTS descricao TEXT DEFAULT ''`;
    await sql`ALTER TABLE mercados ADD COLUMN IF NOT EXISTS rua TEXT DEFAULT ''`;
    await sql`ALTER TABLE mercados ADD COLUMN IF NOT EXISTS bairro TEXT DEFAULT ''`;

    // Slug para mercados criados antes do endereço amigável existir
    await sql`
      UPDATE mercados SET slug = LOWER(REPLACE(REPLACE(REPLACE(nome, ' ', '-'), '.', ''), ',', ''))
      WHERE slug IS NULL
    `;

    // Tabela de assinaturas (planos Asaas)
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

    // Dados do mercado a ser criado APÓS a confirmação do pagamento
    // (o cadastro NÃO cria mais o mercado: o webhook cria quando o Asaas pagar)
    await sql`
      ALTER TABLE assinaturas ADD COLUMN IF NOT EXISTS dados_mercado JSONB
    `;

    // Tabela de pagamentos/faturas das assinaturas
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
