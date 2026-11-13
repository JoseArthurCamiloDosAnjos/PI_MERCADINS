//  013 — Endereço principal da conta do cliente

module.exports = {
  id: '013_endereco_principal',
  descricao: 'Coluna principal na carteira de enderecos do cliente',

  async up(sql) {
    await sql`
      ALTER TABLE enderecos_usuario
        ADD COLUMN IF NOT EXISTS principal BOOLEAN NOT NULL DEFAULT FALSE
    `;

    await sql`
      UPDATE enderecos_usuario e
      SET principal = TRUE
      WHERE NOT EXISTS (
        SELECT 1 FROM enderecos_usuario outro
        WHERE outro.id_usuario = e.id_usuario AND outro.principal
      )
        AND e.id_endereco IN (
          SELECT MIN(id_endereco) FROM enderecos_usuario GROUP BY id_usuario
        )
    `;
  },
};
