// ─────────────────────────────────────────────────────────────────────────────
//  006 — Depoimentos da plataforma e cancelamento de pedido pelo cliente
//
//  • depoimentos (nova tabela): o cliente escreve o que achou do Mercadins
//    (sobre a plataforma como um todo, não sobre um mercado). Cada cliente
//    deixa um depoimento — se escrever de novo, o anterior é atualizado.
//    'oculta' permite ao administrador esconder um depoimento do site sem
//    apagá-lo (mesma lógica de moderação das avaliações — B6).
//  • historico_compras ganha 'motivo_cancelamento': o texto que o cliente
//    informa ao cancelar o próprio pedido (item 4).
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  id: '006_depoimentos_cancelamento_pedido',
  descricao: 'Depoimentos da plataforma e cancelamento de pedido pelo cliente',

  async up(sql) {
    // Depoimentos sobre a plataforma (na página inicial)
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

    // Motivo que o cliente deu ao cancelar o próprio pedido
    await sql`
      ALTER TABLE historico_compras
        ADD COLUMN IF NOT EXISTS motivo_cancelamento TEXT DEFAULT ''
    `;
  },
};
