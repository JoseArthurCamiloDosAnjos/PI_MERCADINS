//  011 — Endereços de entrega salvos na conta do cliente

module.exports = {
  id: '011_enderecos_usuario',
  descricao: 'Enderecos de entrega salvos na conta do cliente',

  async up(sql) {
    await sql`
      CREATE TABLE IF NOT EXISTS enderecos_usuario (
        id_endereco SERIAL PRIMARY KEY,
        id_usuario  INTEGER NOT NULL REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
        cep         TEXT NOT NULL,
        rua         TEXT NOT NULL,
        numero      TEXT NOT NULL,
        bairro      TEXT NOT NULL,
        cidade      TEXT NOT NULL,
        complemento TEXT DEFAULT '',
        criado_em   TIMESTAMP DEFAULT NOW()
      )
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS idx_enderecos_usuario
        ON enderecos_usuario (id_usuario)
    `;
  },
};
