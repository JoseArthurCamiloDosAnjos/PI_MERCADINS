// ─────────────────────────────────────────────────────────────────────────────
// DADOS DE DEMONSTRAÇÃO (um mercado por chip da página inicial)
//
// Cria 7 mercados de vitrine — Hortifruti, Açougue, Padaria, Bebidas,
// Orgânicos, Conveniência e um Supermercado — todos de Taquaritinga, com
// produtos, fotos, avaliações de clientes e pedidos entregues.
//
// Requisitos: backend rodando em http://localhost:3001 (npm run dev no Backend).
// Idempotente: apaga os dados demo anteriores antes de criar de novo.
// Cuidado: o registro de contas tem limite de 5 a cada 15 min — execute no
// máximo 1 vez nesse intervalo.
//
// Uso: node scripts/dados-demo.js
// ─────────────────────────────────────────────────────────────────────────────

const fs = require('fs');
const path = require('path');
const { conectar } = require('../src/db/neon');

const BASE = 'http://localhost:3001';
const SENHA_DEMO = 'SenhaDemo@123';

// ── Contas demo ──────────────────────────────────────────────────────────────
const VENDEDOR = { nome: 'Loja Demo Mercadins', email: 'mercadins.demo.loja@gmail.com', cpf: '96538271626', tel: '16988750001' };
const CLIENTES = [
  { nome: 'Ana Souza',    email: 'mercadins.demo.cliente1@gmail.com', cpf: '93847261509', tel: '16988750002' },
  { nome: 'Bruno Lima',   email: 'mercadins.demo.cliente2@gmail.com', cpf: '94738261509', tel: '16988750003' },
  { nome: 'Carla Mendes', email: 'mercadins.demo.cliente3@gmail.com', cpf: '95629172662', tel: '16988750004' },
];

// ── Mercados demo (um por chip da home) ──────────────────────────────────────
const MERCADOS = [
  {
    nome: 'Supermercado Bom Preço', cats: ['mercado', 'conveniencia'], cor: '0d2858', corTexto: 'f5c84a',
    desc: 'Mercado de bairro com mercearia completa, hortifruti fresquinho e o melhor preço de Taquaritinga. Entregamos na região Centro e arredores.',
    cep: '15900-010', bairro: 'Centro', rua: 'Rua das Palmeiras',
    horario: { '0': ['09:00','12:00'], '1': ['08:00','18:00'], '2': ['08:00','18:00'], '3': ['08:00','18:00'], '4': ['08:00','18:00'], '5': ['08:00','18:00'], '6': ['08:00','16:00'] },
    grupos: [
      { nome: 'Mercearia', produtos: [
        { nome: 'Leite integral 1L',            desc: 'Leite integral pasteurizado', preco: '5,49',  estoque: 60, kw: 'milk' },
        { nome: 'Arroz agulhinha 5kg',          desc: 'Pacote 5kg tipo 1',           preco: '24,90', estoque: 40, kw: 'rice' },
        { nome: 'Feijão carioca 1kg',           desc: 'Pacote 1kg',                  preco: '8,79',  estoque: 50, kw: 'beans' },
        { nome: 'Café torrado e moído 500g',    desc: 'Café forte',                  preco: '16,90', estoque: 35, kw: 'coffee' },
        { nome: 'Açúcar refinado 1kg',          desc: 'Pacote 1kg',                  preco: '4,29',  estoque: 70, kw: 'sugar' },
        { nome: 'Óleo de soja 900ml',           desc: 'Garrafa 900ml',               preco: '7,49',  estoque: 45, kw: 'oil' },
      ]},
      { nome: 'Limpeza', produtos: [
        { nome: 'Detergente neutro',            desc: 'Frasco 500ml',                preco: '2,79',  estoque: 80, kw: 'cleaning' },
        { nome: 'Sabão em pó 800g',             desc: 'Limpeza pesada',              preco: '14,90', estoque: 30, kw: 'laundry' },
        { nome: 'Papel higiênico 12 rolos',     desc: 'Folha dupla',                 preco: '22,90', estoque: 40, kw: 'toilet paper' },
      ]},
    ],
  },
  {
    nome: 'Hortifruti Quintal Verde', cats: ['hortifruti', 'organicos'], cor: '2e7d32', corTexto: 'ffffff',
    desc: 'Hortifruti e produtos orgânicos colhidos no dia. Verduras, frutas e temperos selecionados direto da horta.',
    cep: '15901-500', bairro: 'Jardim Ipanema', rua: 'Avenida Brasil',
    horario: { '0': ['07:00','12:00'], '1': ['06:00','13:00'], '2': ['06:00','13:00'], '3': ['06:00','13:00'], '4': ['06:00','13:00'], '5': ['06:00','13:00'], '6': ['06:00','13:00'] },
    grupos: [
      { nome: 'Hortaliças e Frutas', produtos: [
        { nome: 'Tomate italiano (kg)',    desc: 'Colheita do dia',        preco: '6,99',  estoque: 40, kw: 'tomato' },
        { nome: 'Alface crespa (un)',      desc: 'Folha fresca',           preco: '2,49',  estoque: 60, kw: 'lettuce' },
        { nome: 'Cenoura (kg)',            desc: 'Lavada e selecionada',   preco: '4,99',  estoque: 45, kw: 'carrot' },
        { nome: 'Banana prata (kg)',       desc: 'Madura no ponto',        preco: '5,99',  estoque: 50, kw: 'banana' },
      ]},
      { nome: 'Orgânicos', produtos: [
        { nome: 'Alface orgânica (un)',    desc: 'Plantio sem agrotóxico', preco: '4,49',  estoque: 25, kw: 'organic' },
        { nome: 'Tomate orgânico (kg)',    desc: 'Horta certificada',      preco: '9,99',  estoque: 20, kw: 'organic food' },
        { nome: 'Suco natural 500ml',      desc: 'Sem açúcar',             preco: '7,99',  estoque: 30, kw: 'juice' },
      ]},
    ],
  },
  {
    nome: 'Açougue Boi Gordo', cats: ['acougue'], cor: '8b1e1e', corTexto: 'ffffff',
    desc: 'Carnes bovinas, suínas e aves cortadas do seu jeito, com higiene e qualidade. Frios e embutidos selecionados.',
    cep: '15902-100', bairro: 'Jardim Contendas', rua: 'Rua São Paulo',
    grupos: [
      { nome: 'Carnes', produtos: [
        { nome: 'Patinho moído (kg)',      desc: 'Moído na hora',       preco: '39,90', estoque: 30, kw: 'beef' },
        { nome: 'Frango congelado (kg)',   desc: 'Inteiro',              preco: '13,90', estoque: 40, kw: 'chicken' },
        { nome: 'Costelinha suína (kg)',   desc: 'Com osso',             preco: '24,90', estoque: 25, kw: 'pork' },
        { nome: 'Linguiça toscana (kg)',   desc: 'Artesanal',            preco: '18,90', estoque: 30, kw: 'sausage' },
      ]},
      { nome: 'Frios', produtos: [
        { nome: 'Bacon em cubos 200g',     desc: 'Defumado',             preco: '14,90', estoque: 25, kw: 'bacon' },
        { nome: 'Presunto fatiado 200g',   desc: 'Fatia grossa',         preco: '11,90', estoque: 30, kw: 'ham' },
      ]},
    ],
  },
  {
    nome: 'Padaria Pão Quentinho', cats: ['padaria'], cor: '8a5a2b', corTexto: 'fff8e7',
    desc: 'Padaria e confeitaria com pães fresquinhos o dia todo, salgados, bolos e tortas feitos na hora.',
    cep: '15900-250', bairro: 'Centro', rua: 'Rua XV de Novembro',
    horario: { '0': ['06:00','13:00'], '1': ['05:30','19:00'], '2': ['05:30','19:00'], '3': ['05:30','19:00'], '4': ['05:30','19:00'], '5': ['05:30','20:00'], '6': ['06:00','13:00'] },
    grupos: [
      { nome: 'Pães', produtos: [
        { nome: 'Pão francês (kg)',        desc: 'Fornada das 6h',       preco: '16,90', estoque: 50, kw: 'bread' },
        { nome: 'Pão de forma integral',   desc: '500g',                 preco: '9,90',  estoque: 30, kw: 'toast' },
        { nome: 'Bisnaguinha (kg)',        desc: 'Macia',                preco: '18,90', estoque: 25, kw: 'bun' },
        { nome: 'Pão de mel (un)',         desc: 'Recheado de chocolate',preco: '4,50',  estoque: 40, kw: 'cake' },
      ]},
      { nome: 'Salgados e Doces', produtos: [
        { nome: 'Coxinha (un)',            desc: 'De frango cremoso',    preco: '6,50',  estoque: 30, kw: 'snack' },
        { nome: 'Esfiha de carne (un)',    desc: 'Assada',               preco: '5,50',  estoque: 30, kw: 'pie' },
        { nome: 'Bolo de fubá',            desc: 'Receita da vó',        preco: '28,00', estoque: 20, kw: 'cake' },
        { nome: 'Torta de frango (fatia)', desc: 'Massa folhada',        preco: '8,90',  estoque: 20, kw: 'quiche' },
      ]},
    ],
  },
  {
    nome: 'Bebidas do Ponto', cats: ['bebidas'], cor: '1565c0', corTexto: 'ffffff',
    desc: 'Refrigerantes, sucos, cervejas geladas e vinhos. De tudo para sua festa ou para um fim de semana tranquilo.',
    cep: '15903-050', bairro: 'Vila Baeta', rua: 'Avenida Independência',
    grupos: [
      { nome: 'Refrigerantes e Sucos', produtos: [
        { nome: 'Coca-Cola 2L',            desc: 'Garrafa 2 litros',     preco: '9,99',  estoque: 50, kw: 'soda' },
        { nome: 'Guaraná 2L',              desc: 'Garrafa 2 litros',     preco: '8,49',  estoque: 50, kw: 'soft drink' },
        { nome: 'Suco de uva 1,5L',        desc: 'Néctar',               preco: '7,99',  estoque: 40, kw: 'juice' },
        { nome: 'Água mineral 5L',         desc: 'Galão',                preco: '6,49',  estoque: 60, kw: 'water bottle' },
      ]},
      { nome: 'Cervejas e Vinhos', produtos: [
        { nome: 'Long neck 355ml',         desc: 'Gelada',               preco: '6,99',  estoque: 72, kw: 'beer' },
        { nome: 'Cerveja 600ml',           desc: 'Garrafa longa',        preco: '8,99',  estoque: 40, kw: 'beer bottle' },
        { nome: 'Vinho tinto suave',       desc: 'Garrafa 750ml',        preco: '29,90', estoque: 20, kw: 'wine' },
      ]},
    ],
  },
  {
    nome: 'Orgânicos da Serra', cats: ['organicos', 'hortifruti'], cor: '558b2f', corTexto: 'ffffff',
    desc: 'Produtos orgânicos da serra paulista: mercearia natural, frutas sem agrotóxico e mel puro da região.',
    cep: '15906-100', bairro: 'Sítio São João', rua: 'Rodovia SP-310 km 5',
    grupos: [
      { nome: 'Mercearia Natural', produtos: [
        { nome: 'Grão-de-bico 500g',       desc: 'Orgânico',            preco: '14,90', estoque: 30, kw: 'chickpeas' },
        { nome: 'Quinoa 500g',             desc: 'Importada',           preco: '24,90', estoque: 20, kw: 'quinoa' },
        { nome: 'Mel orgânico 500g',       desc: 'Da serra',            preco: '29,90', estoque: 25, kw: 'honey' },
        { nome: 'Granola 400g',            desc: 'Com castanhas',       preco: '16,90', estoque: 30, kw: 'granola' },
      ]},
      { nome: 'Frutas Orgânicas', produtos: [
        { nome: 'Maçã orgânica (kg)',      desc: 'Sem agrotóxico',      preco: '12,90', estoque: 25, kw: 'apple' },
        { nome: 'Banana orgânica (kg)',    desc: 'Direto da roça',     preco: '8,99',  estoque: 30, kw: 'banana' },
      ]},
    ],
  },
  {
    nome: 'Conveniência 24 Horas', cats: ['conveniencia'], cor: '4527a0', corTexto: 'ffffff',
    desc: 'Loja de conveniência aberta 24 horas: sanduíches, itens rápidos e o que você precisar, a qualquer hora.',
    cep: '15900-001', bairro: 'Centro', rua: 'Rua Amazonas',
    horario: { '0': ['00:00','23:59'], '1': ['00:00','23:59'], '2': ['00:00','23:59'], '3': ['00:00','23:59'], '4': ['00:00','23:59'], '5': ['00:00','23:59'], '6': ['00:00','23:59'] },
    grupos: [
      { nome: 'Praticidade', produtos: [
        { nome: 'Sanduíche pronto',        desc: 'Pronto para levar',   preco: '12,90', estoque: 15, kw: 'sandwich' },
        { nome: 'Pizza congelada',         desc: 'Calabresa 400g',      preco: '24,90', estoque: 12, kw: 'pizza' },
        { nome: 'Macarrão instantâneo',    desc: 'Pronto em 3 minutos', preco: '5,49',  estoque: 40, kw: 'noodles' },
        { nome: 'Saco de gelo 5kg',        desc: 'Barrados',            preco: '8,00',  estoque: 20, kw: 'ice' },
      ]},
      { nome: 'Itens Rápidos', produtos: [
        { nome: 'Bala amendoim',           desc: 'Pacote com 5',        preco: '3,50',  estoque: 50, kw: 'candy' },
        { nome: 'Chiclete',                desc: 'Hortelã',             preco: '2,50',  estoque: 60, kw: 'gum' },
        { nome: 'Pilha AA',                desc: 'Unidade',             preco: '9,90',  estoque: 25, kw: 'battery' },
      ]},
    ],
  },
];

// ── Avaliações demo (cliente → mercado → nota/texto) ─────────────────────────
const AVALIACOES = [
  ['mercadins.demo.cliente1@gmail.com', 'Hortifruti Quintal Verde', 5, 'Verduras sempre frescas, virei cliente!'],
  ['mercadins.demo.cliente1@gmail.com', 'Padaria Pão Quentinho',    5, 'Pão quentinho de manhã, melhor da cidade.'],
  ['mercadins.demo.cliente1@gmail.com', 'Supermercado Bom Preço',   4, 'Bom mercado e preços justos.'],
  ['mercadins.demo.cliente1@gmail.com', 'Conveniência 24 Horas',    5, 'Me salvou de madrugada!'],
  ['mercadins.demo.cliente2@gmail.com', 'Açougue Boi Gordo',        5, 'Carnes de primeira, cortes perfeitos.'],
  ['mercadins.demo.cliente2@gmail.com', 'Hortifruti Quintal Verde', 4, 'Ótima variedade e atendimento.'],
  ['mercadins.demo.cliente2@gmail.com', 'Bebidas do Ponto',         4, 'Tudo gelado e entrega rápida.'],
  ['mercadins.demo.cliente2@gmail.com', 'Padaria Pão Quentinho',    5, 'A coxinha é uma delícia!'],
  ['mercadins.demo.cliente3@gmail.com', 'Orgânicos da Serra',       5, 'Mel orgânico maravilhoso, recomendo.'],
  ['mercadins.demo.cliente3@gmail.com', 'Açougue Boi Gordo',        4, 'Atendimento excelente.'],
  ['mercadins.demo.cliente3@gmail.com', 'Bebidas do Ponto',         5, 'Muitas opções, achei tudo que precisava.'],
  ['mercadins.demo.cliente3@gmail.com', 'Hortifruti Quintal Verde', 5, 'Recomendo demais!'],
  ['mercadins.demo.cliente2@gmail.com', 'Supermercado Bom Preço',   5, 'Preço justo e atendimento rápido.'],
  ['mercadins.demo.cliente3@gmail.com', 'Supermercado Bom Preço',   4, 'Achei tudo que precisei em uma visita só.'],
  ['mercadins.demo.cliente2@gmail.com', 'Conveniência 24 Horas',    4, 'Sempre abre quando mais preciso.'],
  ['mercadins.demo.cliente3@gmail.com', 'Conveniência 24 Horas',    5, 'Atendimento 24h é nota máxima.'],
  ['mercadins.demo.cliente1@gmail.com', 'Açougue Boi Gordo',        5, 'Carnes frescas e bem cortadas.'],
  ['mercadins.demo.cliente1@gmail.com', 'Bebidas do Ponto',         4, 'Preço justo e entrega rápida.'],
  ['mercadins.demo.cliente1@gmail.com', 'Orgânicos da Serra',       5, 'Qualidade que eu procurava.'],
  ['mercadins.demo.cliente2@gmail.com', 'Orgânicos da Serra',       4, 'Mel e granola excelentes.'],
  ['mercadins.demo.cliente3@gmail.com', 'Padaria Pão Quentinho',    4, 'Pão sempre quentinho!'],
];

// ── Avaliações demo de PRODUTOS (cliente → mercado → produto → nota/texto) ───
const AVALIACOES_PRODUTOS = [
  ['mercadins.demo.cliente3@gmail.com', 'Supermercado Bom Preço',   'Arroz agulhinha 5kg',   5, 'Grãos bons e o preço compensa.'],
  ['mercadins.demo.cliente2@gmail.com', 'Supermercado Bom Preço',   'Arroz agulhinha 5kg',   4, 'Bom arroz, embalagem firme.'],
  ['mercadins.demo.cliente3@gmail.com', 'Supermercado Bom Preço',   'Feijão carioca 1kg',    5, 'Fresquinho, cozinha rápido.'],
  ['mercadins.demo.cliente1@gmail.com', 'Supermercado Bom Preço',   'Leite integral 1L',     5, 'Sempre dentro da validade.'],
  ['mercadins.demo.cliente2@gmail.com', 'Supermercado Bom Preço',   'Óleo de soja 900ml',    4, 'Preço melhor que no vizinho.'],
  ['mercadins.demo.cliente1@gmail.com', 'Hortifruti Quintal Verde', 'Tomate italiano (kg)',  5, 'Tomate firme e maduro no ponto.'],
  ['mercadins.demo.cliente3@gmail.com', 'Hortifruti Quintal Verde', 'Tomate italiano (kg)',  4, 'Bem bonito, só faltou ser maior.'],
  ['mercadins.demo.cliente2@gmail.com', 'Hortifruti Quintal Verde', 'Alface crespa (un)',    5, 'Folha crocante, veio lindinha.'],
  ['mercadins.demo.cliente3@gmail.com', 'Hortifruti Quintal Verde', 'Banana prata (kg)',     5, 'Doce no ponto certo.'],
  ['mercadins.demo.cliente2@gmail.com', 'Padaria Pão Quentinho',    'Pão francês (kg)',      5, 'Crocante por fora, macio por dentro.'],
  ['mercadins.demo.cliente1@gmail.com', 'Padaria Pão Quentinho',    'Coxinha (un)',          5, 'Recheio cremoso demais!'],
  ['mercadins.demo.cliente3@gmail.com', 'Açougue Boi Gordo',        'Patinho moído (kg)',    5, 'Carne moída fresca, sem excesso de água.'],
  ['mercadins.demo.cliente2@gmail.com', 'Bebidas do Ponto',         'Coca-Cola 2L',          4, 'Gelada na entrega, nota alta.'],
  ['mercadins.demo.cliente3@gmail.com', 'Orgânicos da Serra',       'Mel orgânico 500g',     5, 'Sabor incomparável, vale cada centavo.'],
  ['mercadins.demo.cliente1@gmail.com', 'Conveniência 24 Horas',    'Sanduíche pronto',      4, 'Salvou meu jantar, razoável.'],
];

// ── Pedidos demo (cliente → mercado → itens [nome do produto, qtd]) ──────────
const PEDIDOS = [
  ['mercadins.demo.cliente1@gmail.com', 'Hortifruti Quintal Verde', [['Tomate italiano (kg)', 1], ['Alface crespa (un)', 2]]],
  ['mercadins.demo.cliente1@gmail.com', 'Padaria Pão Quentinho',    [['Pão francês (kg)', 1], ['Coxinha (un)', 3]]],
  ['mercadins.demo.cliente1@gmail.com', 'Conveniência 24 Horas',    [['Sanduíche pronto', 1]]],
  ['mercadins.demo.cliente2@gmail.com', 'Açougue Boi Gordo',        [['Patinho moído (kg)', 1], ['Bacon em cubos 200g', 2]]],
  ['mercadins.demo.cliente2@gmail.com', 'Bebidas do Ponto',         [['Coca-Cola 2L', 2], ['Long neck 355ml', 6]]],
  ['mercadins.demo.cliente3@gmail.com', 'Orgânicos da Serra',       [['Mel orgânico 500g', 1], ['Granola 400g', 2]]],
  ['mercadins.demo.cliente3@gmail.com', 'Supermercado Bom Preço',   [['Arroz agulhinha 5kg', 1], ['Feijão carioca 1kg', 2], ['Óleo de soja 900ml', 1]]],
  ['mercadins.demo.cliente3@gmail.com', 'Hortifruti Quintal Verde', [['Banana prata (kg)', 2]]],
];

// ── Utilidades ───────────────────────────────────────────────────────────────
function gerarCNPJ() {
  const base = String(Math.floor(100000000000 + Math.random() * 899999999999));
  const calc = (nums, pesos) => {
    const soma = nums.split('').reduce((acc, d, i) => acc + Number(d) * pesos[i], 0);
    const r = soma % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const d1 = calc(base, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = calc(base + d1, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return base + d1 + d2;
}

async function rota(metodo, caminho, { token, body } = {}) {
  const res = await fetch(`${BASE}${caminho}`, {
    method: metodo,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

// Upload de imagens pro bucket do Supabase (mesmo caminho que o site usa).
// ATENÇÃO: o bucket "imagens" está com política que recusa uploads anônimos —
// nem o site consegue enviar foto agora. Enquanto o time não corrigir a
// política no painel do Supabase, a demo usa as imagens por URL direta
// (placehold.co), que o site renderiza normalmente.
let supaUrl = null;
let supaKey = null;
let semBucket = false;

function carregarEnvSupabase() {
  // Vite une .env e .env.local (o .env.local tem precedência) — lemos os dois
  for (const arquivo of ['.env.local', '.env']) {
    try {
      const env = fs.readFileSync(path.join(__dirname, '../../Frontend', arquivo), 'utf8');
      for (const linha of env.split(/\r?\n/)) {
        const [chave, valor] = linha.split('=');
        if (!valor) continue;
        if (chave?.trim() === 'VITE_SUPABASE_URL') supaUrl = valor.trim();
        if (['VITE_SUPABASE_ANON_KEY', 'VITE_SUPABASE_PUBLISHABLE_KEY'].includes(chave?.trim())) {
          supaKey = valor.trim();
        }
      }
    } catch { /* arquivo sem .env → ignora */ }
  }
  if (!supaUrl || !supaKey) semBucket = true;
}

async function imagemDemo(fonte, caminho) {
  if (!semBucket) {
    try {
      const baixada = await fetch(fonte, { redirect: 'follow' });
      if (!baixada.ok) throw new Error(`download ${baixada.status}`);
      const tipo = baixada.headers.get('content-type') || 'image/png';
      const bytes = Buffer.from(await baixada.arrayBuffer());

      const enviado = await fetch(`${supaUrl}/storage/v1/object/imagens/${caminho}`, {
        method: 'POST',
        headers: {
          apikey: supaKey,
          Authorization: `Bearer ${supaKey}`,
          'Content-Type': tipo,
          'x-upsert': 'true', // re-execuções sobrescrevem em vez de falhar
        },
        body: bytes,
      });
      if (!enviado.ok) throw new Error(`upload ${enviado.status}`);
      return `${supaUrl}/storage/v1/object/public/imagens/${caminho}`;
    } catch (e) {
      console.log(`  (bucket recusou — seguindo com imagem direta: ${e.message})`);
      semBucket = true;
    }
  }
  return fonte; // URL direta: o site renderiza normalmente
}

// Card de imagem com texto (placehold.co) — confiável e com cara de demonstração
function cardImagem(largura, altura, fundo, texto, corTexto = 'ffffff') {
  return `https://placehold.co/${largura}x${altura}/${fundo}/${corTexto}/png?text=${encodeURIComponent(texto)}`;
}

async function registrarConta(conta) {
  const r = await rota('POST', '/api/auth/register', {
    body: { nome: conta.nome, email: conta.email, senha: SENHA_DEMO, confirmarSenha: SENHA_DEMO, telefone: conta.tel, cpf: conta.cpf },
  });
  if (![200, 201].includes(r.status)) throw new Error(`registro ${conta.email}: ${r.status} ${r.body.erro || ''}`);
}

async function logar(email) {
  const r = await rota('POST', '/api/auth/login', { body: { email, senha: SENHA_DEMO } });
  if (!r.body.token) throw new Error(`login ${email} falhou: ${r.body.erro || ''}`);
  return r.body.token;
}

// ── Programa principal ───────────────────────────────────────────────────────
(async () => {
  const sql = await conectar();
  carregarEnvSupabase();

  // 1. Apaga dados demo anteriores (cascata: favoritos/avaliações/histórico)
  console.log('Limpando dados demo anteriores (se existirem)...');
  // Primeiro descobre os ids dos mercados demo, depois apaga na ordem das
  // dependências: produtos → categorias → vínculos → mercados.
  const slugsDemo = MERCADOS.map(m => m.nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
  const mercadosDemo = await sql`
    SELECT DISTINCT m.id_mercado FROM mercados m
    LEFT JOIN usuarios_mercados um ON um.id_mercado = m.id_mercado
    LEFT JOIN usuarios u ON u.id_usuario = um.id_usuario
    WHERE u.email LIKE 'mercadins.demo.%' OR m.slug = ANY(${slugsDemo})
  `;
  const idsDemo = mercadosDemo.map(m => m.id_mercado);
  if (idsDemo.length > 0) {
    await sql`DELETE FROM produtos WHERE id_categoria IN (SELECT id_categoria FROM categorias WHERE id_mercado = ANY(${idsDemo}))`;
    await sql`DELETE FROM categorias WHERE id_mercado = ANY(${idsDemo})`;
    await sql`DELETE FROM usuarios_mercados WHERE id_mercado = ANY(${idsDemo})`;
    await sql`DELETE FROM mercados WHERE id_mercado = ANY(${idsDemo})`;
  }
  // As contas demo ficam no banco (reaproveitadas) — recriar toda vez estouraria
  // o limite de 5 registros a cada 15 minutos da API.

  // 2. Contas (cria só as que faltam)
  const jaExistentes = new Set(
    (await sql`SELECT email FROM usuarios WHERE email LIKE 'mercadins.demo.%'`).map(u => u.email)
  );
  for (const conta of [VENDEDOR, ...CLIENTES]) {
    if (jaExistentes.has(conta.email)) {
      console.log(`Conta já existe, reaproveitando: ${conta.email}`);
    } else {
      console.log(`Criando conta: ${conta.email}`);
      await registrarConta(conta);
    }
  }
  await sql`UPDATE usuarios SET email_verificado = TRUE WHERE email LIKE 'mercadins.demo.%'`;
  const tokenVendedor = await logar(VENDEDOR.email);
  const tokensClientes = {};
  for (const c of CLIENTES) tokensClientes[c.email] = await logar(c.email);
  console.log('Contas prontas (email já verificado).');

  // 3. Mercados + produtos (com imagens quando o Supabase aceitar)
  const idsProdutos = {}; // nomeDoMercado → { nomeDoProduto: id }
  let totalProdutos = 0;

  for (const m of MERCADOS) {
    const criado = await rota('POST', '/api/mercados', {
      token: tokenVendedor,
      body: {
        nome: m.nome,
        email: `${m.nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, '')}@demo.mercadins.com.br`,
        telefone: '16988755641',
        cnpj: gerarCNPJ(),
        cep: m.cep,
        estado: 'SP',
        cidade: 'Taquaritinga',
        bairro: m.bairro,
        rua: m.rua,
        descricao: m.desc,
        categorias: m.cats,
        horario: m.horario ?? null,
      },
    });
    if (criado.status !== 201) throw new Error(`criar mercado ${m.nome}: ${criado.status} ${criado.body.erro || ''}`);
    const idMercado = criado.body.mercado.id_mercado;
    const slug = criado.body.mercado.slug;

    // Banner e logo (cards coloridos com o nome da loja)
    const bannerUrl = await imagemDemo(cardImagem(1200, 320, m.cor, `${m.nome} · Taquaritinga`, m.corTexto), `mercados/${slug}-banner.png`);
    const logoUrl = await imagemDemo(cardImagem(400, 400, m.cor, m.nome.split(' ')[0], m.corTexto), `mercados/${slug}-logo.png`);
    if (bannerUrl || logoUrl) {
      await rota('PUT', `/api/mercados/${idMercado}`, {
        token: tokenVendedor,
        body: { banner_url: bannerUrl ?? undefined, foto_perfil_url: logoUrl ?? undefined },
      });
    }

    idsProdutos[m.nome] = {};
    let idxProduto = 0;

    for (const g of m.grupos) {
      const cat = await rota('POST', `/api/mercados/${idMercado}/categorias`, {
        token: tokenVendedor, body: { nome: g.nome },
      });
      if (cat.status !== 201) throw new Error(`criar categoria ${g.nome}: ${cat.status}`);
      const idCategoria = cat.body.id;

      for (const p of g.produtos) {
        idxProduto += 1;
        const fotoUrl = await imagemDemo(cardImagem(400, 400, m.cor, p.nome, m.corTexto), `produtos/${slug}-${idxProduto}.png`);

        const prod = await rota('POST', `/api/mercados/${idMercado}/categorias/${idCategoria}/produtos`, {
          token: tokenVendedor,
          body: { nome: p.nome, descricao: p.desc, preco: p.preco, estoque: p.estoque, imagens: fotoUrl ? [fotoUrl] : [] },
        });
        if (prod.status !== 201) throw new Error(`criar produto ${p.nome}: ${prod.status} ${prod.body.erro || ''}`);
        idsProdutos[m.nome][p.nome] = prod.body.id_produto;
        totalProdutos += 1;
      }
    }
    console.log(`  ✓ ${m.nome} (${m.cats.join(' + ')}) — ${m.grupos.reduce((n, g) => n + g.produtos.length, 0)} produtos`);
  }

  // 4. Avaliações
  let totalAvaliacoes = 0;
  for (const [email, mercado, nota, texto] of AVALIACOES) {
    const mercadoMeta = MERCADOS.find(m => m.nome === mercado);
    const idMercado = (await sql`SELECT id_mercado FROM mercados WHERE slug = ${mercadoMeta.nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`)[0]?.id_mercado;
    const r = await rota('POST', `/api/mercados/${idMercado}/avaliacoes`, {
      token: tokensClientes[email], body: { nota, texto },
    });
    if (r.status === 201) totalAvaliacoes += 1;
    else console.log(`  (avaliação falhou: ${r.status} ${r.body.erro || ''})`);
  }
  console.log(`  ✓ ${totalAvaliacoes} avaliações de clientes`);

  // 4b. Avaliações de produtos (estrelas por item da vitrine)
  let totalAvaliacoesProdutos = 0;
  for (const [email, mercado, produto, nota, texto] of AVALIACOES_PRODUTOS) {
    const mercadoMeta = MERCADOS.find(m => m.nome === mercado);
    const slugMercado = mercadoMeta.nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const idMercado = (await sql`SELECT id_mercado FROM mercados WHERE slug = ${slugMercado}`)[0]?.id_mercado;
    const prodRow = (await sql`
      SELECT p.id_produto, p.id_categoria
      FROM produtos p JOIN categorias c ON c.id_categoria = p.id_categoria
      WHERE p.nome = ${produto} AND c.id_mercado = ${idMercado}
      LIMIT 1
    `)[0];
    if (!prodRow) {
      console.log(`  (avaliação de produto falhou: "${produto}" não encontrado em ${mercado})`);
      continue;
    }
    const r = await rota('POST', `/api/mercados/${idMercado}/categorias/${prodRow.id_categoria}/produtos/${prodRow.id_produto}/avaliacoes`, {
      token: tokensClientes[email], body: { nota, texto },
    });
    if (r.status === 201) totalAvaliacoesProdutos += 1;
    else console.log(`  (avaliação de produto falhou: ${r.status} ${r.body.erro || ''})`);
  }
  console.log(`  ✓ ${totalAvaliacoesProdutos} avaliações de produtos`);

  // 5. Pedidos (contam nos "pedidos entregues" da home; a cada outro fica
  //    "entregue" pra mostrar os dois estados no histórico e no painel)
  let totalPedidos = 0;
  const idsPedidos = [];
  for (const [email, mercado, itens] of PEDIDOS) {
    const mercadoMeta = MERCADOS.find(m => m.nome === mercado);
    const slugMercado = mercadoMeta.nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const idMercado = (await sql`SELECT id_mercado FROM mercados WHERE slug = ${slugMercado}`)[0]?.id_mercado;
    const corpo = { itens: itens.map(([nomeProduto, quantidade]) => ({ id_produto: idsProdutos[mercado][nomeProduto], quantidade })) };
    const r = await rota('POST', `/api/mercados/${idMercado}/pedidos`, { token: tokensClientes[email], body: corpo });
    if (r.status >= 200 && r.status < 300) {
      totalPedidos += 1;
      if (r.body?.pedido?.id) idsPedidos.push(r.body.pedido.id);
    }
    else console.log(`  (pedido falhou: ${r.status} ${r.body.erro || ''})`);
  }
  const idsEntregues = idsPedidos.filter((_, i) => i % 2 === 1);
  if (idsEntregues.length > 0) {
    await sql`UPDATE historico_compras SET status = 'entregue' WHERE id = ANY(${idsEntregues})`;
  }
  console.log(`  ✓ ${totalPedidos} pedidos criados (${idsEntregues.length} já entregues)`);

  // 6. Resumo
  console.log('\n================ DEMO PRONTA ================');
  console.log(`Mercados: ${MERCADOS.length} | Produtos: ${totalProdutos} | Avaliações: ${totalAvaliacoes} + ${totalAvaliacoesProdutos} de produtos | Pedidos: ${totalPedidos}`);
  console.log(`Imagens: ${semBucket ? 'diretas (placehold.co) — bucket do Supabase recusa upload anônimo; corrigir política no painel' : 'enviadas pro bucket'}`);
  console.log('\nContas para apresentar:');
  console.log(`  Vendedor(a): ${VENDEDOR.email} / ${SENHA_DEMO}`);
  for (const c of CLIENTES) console.log(`  Cliente:     ${c.email} / ${SENHA_DEMO}`);
  console.log('\nAbra http://localhost:5173/ e clique em cada chip da home.');
  process.exit(0);
})().catch((e) => {
  console.error('ERRO:', e.message);
  process.exit(1);
});
