require('dotenv').config();
const { conectar } = require('./neon');

async function migrate() {
  const sql = await conectar();

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

  // Adiciona colunas de paleta de cores se não existirem
  await sql`
    ALTER TABLE mercados ADD COLUMN IF NOT EXISTS paleta TEXT DEFAULT 'classico'
  `;
  await sql`
    ALTER TABLE mercados ADD COLUMN IF NOT EXISTS cor_base TEXT DEFAULT ''
  `;
  await sql`
    ALTER TABLE mercados ADD COLUMN IF NOT EXISTS cor_destaque TEXT DEFAULT ''
  `;
  await sql`
    ALTER TABLE mercados ADD COLUMN IF NOT EXISTS cor_texto TEXT DEFAULT ''
  `;
  await sql`
    ALTER TABLE mercados ADD COLUMN IF NOT EXISTS cor_icones TEXT DEFAULT ''
  `;
  await sql`
    ALTER TABLE mercados ADD COLUMN IF NOT EXISTS cor_texto_sec TEXT DEFAULT ''
  `;
  await sql`
    ALTER TABLE mercados ADD COLUMN IF NOT EXISTS banner TEXT DEFAULT ''
  `;
  await sql`
    ALTER TABLE mercados ADD COLUMN IF NOT EXISTS foto_perfil TEXT DEFAULT ''
  `;

  // Adiciona coluna descricao na tabela mercados se não existir
  await sql`
    ALTER TABLE mercados ADD COLUMN IF NOT EXISTS descricao TEXT DEFAULT ''
  `;

  // Garante colunas de endereço separadas (rua e bairro) na tabela mercados
  await sql`
    ALTER TABLE mercados ADD COLUMN IF NOT EXISTS rua TEXT DEFAULT ''
  `;
  await sql`
    ALTER TABLE mercados ADD COLUMN IF NOT EXISTS bairro TEXT DEFAULT ''
  `;

  // Adiciona coluna slug se não existir
  await sql`
    ALTER TABLE mercados ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE
  `;

  // Adiciona coluna foto_perfil na tabela usuarios se não existir
  await sql`
    ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS foto_perfil TEXT DEFAULT ''
  `;

  // Adiciona coluna cpf na tabela usuarios se não existir
  await sql`
    ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS cpf TEXT DEFAULT ''
  `;

  // Adiciona coluna data_nascimento na tabela usuarios se não existir
  await sql`
    ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS data_nascimento DATE
  `;

  // Atualiza slug para mercados existentes
  await sql`
    UPDATE mercados SET slug = LOWER(REPLACE(REPLACE(REPLACE(nome, ' ', '-'), '.', ''), ',', ''))
    WHERE slug IS NULL
  `;

  // Adiciona coluna preco na tabela produtos se não existir
  await sql`
    ALTER TABLE produtos ADD COLUMN IF NOT EXISTS preco NUMERIC(10,2) DEFAULT 0
  `;

  // Adiciona coluna imagens (array de URLs) na tabela produtos se não existir
  await sql`
    ALTER TABLE produtos ADD COLUMN IF NOT EXISTS imagens TEXT[] DEFAULT '{}'
  `;

  // Adiciona coluna estoque na tabela produtos se não existir
  await sql`
    ALTER TABLE produtos ADD COLUMN IF NOT EXISTS estoque INTEGER DEFAULT 0
  `;

  // Tabela de carrinho por usuário
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
  await sql`
  ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;
  `;

  // Adiciona coluna status na tabela mercados se não existir
  await sql`
    ALTER TABLE mercados ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'ativo'
  `;

  // Adiciona coluna email_admin na tabela usuarios se não existir
  await sql`
    ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS email_admin TEXT DEFAULT ''
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

  // Adiciona coluna plano na tabela mercados se não existir
  // (define os limites de produtos e fotos: basico | profissional | personalizado)
  await sql`
    ALTER TABLE mercados ADD COLUMN IF NOT EXISTS plano TEXT DEFAULT 'basico'
  `;

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
  await sql`
    ALTER TABLE historico_compras ADD COLUMN IF NOT EXISTS observacao TEXT DEFAULT ''
  `;

  // Categorias são por mercado (cada loja tem sua padaria, sua bebidas...).
  // A antiga restrição de nome único era GLOBAL e impedia dois mercados de
  // terem a mesma categoria — removida para o cadastro funcionar.
  await sql`
    ALTER TABLE categorias DROP CONSTRAINT IF EXISTS categorias_nome_key
  `;

  // Horário de funcionamento, salvo como JSON dentro de um texto:
  //   {"1":["08:00","18:00"],"6":["10:00","14:00"]}
  // Chave = dia da semana (0 = domingo ... 6 = sábado, igual ao Date do JS).
  // Dia ausente = fechado naquele dia. Se a hora de FECHAR for menor que a
  // de ABRIR, o mercado fecha depois da meia-noite (ex.: 18:00 → 02:00).
  // Valor nulo = mercado ainda não configurou o horário.
  await sql`
    ALTER TABLE mercados ADD COLUMN IF NOT EXISTS horario TEXT DEFAULT NULL
  `;

  console.log('Tabelas criadas com sucesso!');
}


migrate().catch(err => {
  console.error('Erro na migração:', err.message);
  process.exit(1);
});
