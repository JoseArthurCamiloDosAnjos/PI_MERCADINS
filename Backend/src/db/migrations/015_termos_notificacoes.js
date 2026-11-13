
module.exports = {
  id: '015_termos_notificacoes',
  descricao: 'Aceite de termos no cadastro e histórico de notificações por telefone',
  up: async (sql) => {
    // ── Aceite no cadastro de usuários ─────────────────────────────────────
    await sql`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS termos_aceitos_em TIMESTAMP`;
    await sql`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS termos_versao TEXT DEFAULT ''`;
    await sql`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS termos_ip TEXT DEFAULT ''`;

    // ── Aceite no cadastro de mercados ─────────────────────────────────────
    await sql`ALTER TABLE mercados ADD COLUMN IF NOT EXISTS termos_aceitos_em TIMESTAMP`;
    await sql`ALTER TABLE mercados ADD COLUMN IF NOT EXISTS termos_versao TEXT DEFAULT ''`;
    await sql`ALTER TABLE mercados ADD COLUMN IF NOT EXISTS termos_ip TEXT DEFAULT ''`;

    // ── Histórico de notificações por telefone ─────────────────────────────
    await sql`
      CREATE TABLE IF NOT EXISTS notificacoes (
        id SERIAL PRIMARY KEY,
        id_usuario INTEGER REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
        id_mercado INTEGER REFERENCES mercados(id_mercado) ON DELETE CASCADE,
        telefone TEXT DEFAULT '',
        canal TEXT DEFAULT 'whatsapp',
        tipo TEXT NOT NULL,
        titulo TEXT DEFAULT '',
        mensagem TEXT NOT NULL,
        status TEXT DEFAULT 'registrada',
        erro TEXT DEFAULT '',
        criado_em TIMESTAMP DEFAULT NOW(),
        enviado_em TIMESTAMP
      )
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS idx_notificacoes_usuario
      ON notificacoes (id_usuario)
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_notificacoes_mercado
      ON notificacoes (id_mercado)
    `;
  },
};
