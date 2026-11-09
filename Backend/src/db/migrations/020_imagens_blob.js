module.exports = {
  id: '020_imagens_blob',
  descricao: 'Armazenamento das imagens no banco (bytea) com deduplicacao por hash',

  async up(sql) {
    await sql`
      CREATE TABLE IF NOT EXISTS imagens (
        id_imagem  BIGSERIAL PRIMARY KEY,
        hash       CHAR(64) NOT NULL UNIQUE,
        mime       VARCHAR(30) NOT NULL,
        tamanho    INTEGER NOT NULL,
        dados      BYTEA NOT NULL,
        id_usuario INTEGER REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
        criado_em  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS idx_imagens_criado_em
        ON imagens (criado_em)
    `;
  },
};
