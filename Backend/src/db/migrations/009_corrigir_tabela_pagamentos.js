//  009 — Corrige a tabela "pagamentos"

module.exports = {
  id: '009_corrigir_tabela_pagamentos',
  descricao: 'Cria a tabela pagamentos correta das assinaturas (esquema legado renomeado)',

  async up(sql) {
    const [errada] = await sql`
      SELECT 1 FROM information_schema.tables t
      WHERE t.table_name = 'pagamentos'
        AND NOT EXISTS (
          SELECT 1 FROM information_schema.columns c
          WHERE c.table_name = 'pagamentos' AND c.column_name = 'id_assinatura'
        )
      LIMIT 1
    `;
    if (errada) {
      const [destinoExiste] = await sql`
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'pagamentos_legado' LIMIT 1
      `;
      if (destinoExiste) {
        await sql`DROP TABLE pagamentos`;
      } else {
        await sql`ALTER TABLE pagamentos RENAME TO pagamentos_legado`;
      }
    }

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
