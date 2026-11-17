module.exports = {
  id: '024_mapa_2fa',
  descricao: 'Adiciona latitude/longitude aos mercados e colunas de verificação em duas etapas aos usuários',

  async up(sql) {
    // ── Mapa: coordenadas dos mercados ──────────────────────────────
    await sql`ALTER TABLE mercados ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION`;
    await sql`ALTER TABLE mercados ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION`;

    // ── Verificação em duas etapas (2FA) ───────────────────────────
    await sql`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS dois_fatores BOOLEAN DEFAULT FALSE`;
    await sql`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS dois_fatores_codigo TEXT`;
    await sql`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS dois_fatores_expiracao TIMESTAMP`;
    await sql`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS dois_fatores_tentativas INTEGER DEFAULT 0`;
  },
};
