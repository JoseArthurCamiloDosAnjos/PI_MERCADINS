// Migração 001 — estrutura inicial do banco (favoritos, avaliações, carrinho,
// histórico de compras, colunas de paleta/banner/slug/plano, função de busca
// sem acento e horário de funcionamento).
// Idempotente: pode rodar de novo sem quebrar nada (tudo IF NOT EXISTS).

module.exports = {
  id: '001_estrutura_inicial',
  descricao: 'Estrutura inicial: tabelas de apoio e colunas base de mercados/produtos/usuarios',
  up: async (sql) => {
    await sql`
      CREATE TABLE IF NOT EXISTS favoritos (
        id SERIAL PRIMARY KEY,
        id_usuario INTEGER NOT NULL REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
        id_mercado INTEGER NOT NULL REFERENCES mercados(id_mercado) ON DELETE CASCADE,
        data_cadastro TIMESTAMP DEFAULT NOW(),
        UNIQUE(id_usuario, id_mercado)
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS avaliacoes (
        id SERIAL PRIMARY KEY,
        id_usuario INTEGER NOT NULL REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
        id_mercado INTEGER NOT NULL REFERENCES mercados(id_mercado) ON DELETE CASCADE,
        nota INTEGER NOT NULL CHECK (nota >= 1 AND nota <= 5),
        texto TEXT DEFAULT '',
        data_cadastro TIMESTAMP DEFAULT NOW(),
        UNIQUE(id_usuario, id_mercado)
      )
    `;

    // Avaliações de produto (estrelas por item) — mesmo formato das de mercado
    await sql`
      CREATE TABLE IF NOT EXISTS avaliacoes_produtos (
        id SERIAL PRIMARY KEY,
        id_usuario INTEGER NOT NULL REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
        id_produto INTEGER NOT NULL REFERENCES produtos(id_produto) ON DELETE CASCADE,
        nota INTEGER NOT NULL CHECK (nota >= 1 AND nota <= 5),
        texto TEXT DEFAULT '',
        data_cadastro TIMESTAMP DEFAULT NOW(),
        UNIQUE(id_usuario, id_produto)
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS historico_compras (
        id SERIAL PRIMARY KEY,
        id_usuario INTEGER NOT NULL REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
        id_mercado INTEGER NOT NULL REFERENCES mercados(id_mercado) ON DELETE CASCADE,
        produtos TEXT DEFAULT '',
        valor_total DECIMAL(10,2) DEFAULT 0,
        data_compra TIMESTAMP DEFAULT NOW(),
        status TEXT DEFAULT 'entregue'
      )
    `;

    // Cores da paleta e imagens da loja
    await sql`ALTER TABLE mercados ADD COLUMN IF NOT EXISTS paleta TEXT DEFAULT 'classico'`;
    await sql`ALTER TABLE mercados ADD COLUMN IF NOT EXISTS cor_base TEXT DEFAULT ''`;
    await sql`ALTER TABLE mercados ADD COLUMN IF NOT EXISTS cor_destaque TEXT DEFAULT ''`;
    await sql`ALTER TABLE mercados ADD COLUMN IF NOT EXISTS cor_texto TEXT DEFAULT ''`;
    await sql`ALTER TABLE mercados ADD COLUMN IF NOT EXISTS cor_icones TEXT DEFAULT ''`;
    await sql`ALTER TABLE mercados ADD COLUMN IF NOT EXISTS cor_texto_sec TEXT DEFAULT ''`;
    await sql`ALTER TABLE mercados ADD COLUMN IF NOT EXISTS banner TEXT DEFAULT ''`;
    await sql`ALTER TABLE mercados ADD COLUMN IF NOT EXISTS foto_perfil TEXT DEFAULT ''`;

    // Endereço legível em URL (/vitrine/meu-mercado)
    await sql`ALTER TABLE mercados ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE`;

    // Dados do usuário
    await sql`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS foto_perfil TEXT DEFAULT ''`;
    await sql`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS cpf TEXT DEFAULT ''`;
    await sql`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS data_nascimento DATE`;

    // Slug dos mercados que já existiam antes da coluna
    await sql`
      UPDATE mercados SET slug = LOWER(REPLACE(REPLACE(REPLACE(nome, ' ', '-'), '.', ''), ',', ''))
      WHERE slug IS NULL
    `;

    // Produto
    await sql`ALTER TABLE produtos ADD COLUMN IF NOT EXISTS preco NUMERIC(10,2) DEFAULT 0`;
    await sql`ALTER TABLE produtos ADD COLUMN IF NOT EXISTS imagens TEXT[] DEFAULT '{}'`;
    await sql`ALTER TABLE produtos ADD COLUMN IF NOT EXISTS estoque INTEGER DEFAULT 0`;

    // Carrinho por usuário
    await sql`
      CREATE TABLE IF NOT EXISTS carrinho (
        id SERIAL PRIMARY KEY,
        id_usuario INTEGER NOT NULL REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
        id_mercado INTEGER NOT NULL REFERENCES mercados(id_mercado) ON DELETE CASCADE,
        id_produto INTEGER NOT NULL REFERENCES produtos(id_produto) ON DELETE CASCADE,
        quantidade INTEGER NOT NULL DEFAULT 1,
        data_cadastro TIMESTAMP DEFAULT NOW(),
        UNIQUE(id_usuario, id_mercado, id_produto)
      )
    `;

    await sql`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE`;
    await sql`ALTER TABLE mercados ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'ativo'`;
    await sql`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS email_admin TEXT DEFAULT ''`;

    // Plano da assinatura (limita produtos e fotos: basico | profissional | personalizado)
    await sql`ALTER TABLE mercados ADD COLUMN IF NOT EXISTS plano TEXT DEFAULT 'basico'`;

    // Função auxiliar da busca de produtos (ignora acentos e maiúsculas)
    await sql`
      CREATE OR REPLACE FUNCTION sem_acento(txt TEXT)
      RETURNS TEXT
      LANGUAGE sql
      IMMUTABLE
      AS $$
        SELECT lower(translate(
          txt,
          'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
          'aaaaaeeeeiiiiooooouuuucnaaaaaeeeeiiiiooooouuuucn'
        ))
      $$
    `;

    // Observação do cliente no pedido (ex.: "sem cebola", "entregar na portaria")
    await sql`ALTER TABLE historico_compras ADD COLUMN IF NOT EXISTS observacao TEXT DEFAULT ''`;

    // Categorias são por mercado (cada loja tem sua padaria, sua bebidas...).
    // A antiga restrição de nome único era GLOBAL e impedia dois mercados de
    // terem a mesma categoria — removida para o cadastro funcionar.
    await sql`ALTER TABLE categorias DROP CONSTRAINT IF EXISTS categorias_nome_key`;

    // Horário de funcionamento, salvo como JSON dentro de um texto:
    //   {"1":["08:00","18:00"],"6":["10:00","14:00"]}
    // Chave = dia da semana (0 = domingo ... 6 = sábado). Dia ausente = fechado.
    await sql`ALTER TABLE mercados ADD COLUMN IF NOT EXISTS horario TEXT DEFAULT NULL`;
  },
};
