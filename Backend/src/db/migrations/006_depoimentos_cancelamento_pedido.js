//  006 — Depoimentos da plataforma e cancelamento de pedido pelo cliente

module.exports = {
  id: '006_depoimentos_cancelamento_pedido',
  descricao: 'Depoimentos da plataforma e cancelamento de pedido pelo cliente',

  async up(sql) {
    await sql`
      CREATE TABLE IF NOT EXISTS depoimentos (
        id SERIAL PRIMARY KEY,
        id_usuario INTEGER NOT NULL REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
        nota INTEGER NOT NULL CHECK (nota >= 1 AND nota <= 5),
        texto TEXT DEFAULT '',
        oculta BOOLEAN NOT NULL DEFAULT FALSE,
        data_cadastro TIMESTAMP DEFAULT NOW(),
        UNIQUE(id_usuario)
      )
    `;

    await sql`
      ALTER TABLE historico_compras
        ADD COLUMN IF NOT EXISTS motivo_cancelamento TEXT DEFAULT ''
    `;
  },
};
