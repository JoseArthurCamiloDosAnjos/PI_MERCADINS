const { conectar } = require("../db/neon");
const { limitesDoPlano, normalizarPlano } = require("../utils/planos");

// ─────────────────────────────────────────────
// Helper — gera slug a partir do nome
// ─────────────────────────────────────────────

function gerarSlug(nome) {
  return nome
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

// ─────────────────────────────────────────────
// Helpers de validação
// ─────────────────────────────────────────────

function limparMascara(valor) {
  return valor.replace(/\D/g, "");
}

function validarCNPJ(cnpj) {
  const nums = limparMascara(cnpj);
  if (nums.length !== 14) return false;
  if (/^(\d)\1+$/.test(nums)) return false;

  const calcDigito = (base, pesos) => {
    const soma = base
      .split("")
      .reduce((acc, d, i) => acc + parseInt(d) * pesos[i], 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };

  const pesos1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const pesos2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  const d1 = calcDigito(nums.slice(0, 12), pesos1);
  const d2 = calcDigito(nums.slice(0, 13), pesos2);

  return parseInt(nums[12]) === d1 && parseInt(nums[13]) === d2;
}

function validarCEP(cep) {
  return /^\d{8}$/.test(limparMascara(cep));
}

function validarEmailSimples(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validarTelefone(telefone) {
  const nums = limparMascara(telefone);
  return nums.length === 10 || nums.length === 11;
}

// ── Tipos de loja (categorias do mercado) ───────────────────────────────
// Mesmos tipos dos atalhos da página inicial. O valor é validado contra a
// lista e salvo como literal de array do Postgres ("{mercado,padaria}"),
// formato que funciona nos dois drivers (Neon e PostgreSQL local).
const CATEGORIAS_VALIDAS = [
  "mercado", "hortifruti", "acougue", "padaria", "bebidas", "organicos", "conveniencia",
];

// Nome bonito de cada tipo para a aba da vitrine (o tipo é sempre minúsculo)
const LABELS_CATEGORIAS = {
  mercado: "Mercado", hortifruti: "Hortifruti", acougue: "Açougue",
  padaria: "Padaria", bebidas: "Bebidas", organicos: "Orgânicos",
  conveniencia: "Conveniência",
};

function normalizarCategorias(categorias) {
  if (categorias === undefined || categorias === null) return { valor: null, lista: [] };

  // Revalidação de um payload JÁ normalizado pelo próprio validador
  // (o checkout grava {valor, lista} em dados_mercado e o webhook valida de novo)
  if (!Array.isArray(categorias) && typeof categorias === "object") {
    if (Array.isArray(categorias.lista)) return normalizarCategorias(categorias.lista);
    if (typeof categorias.valor === "string") {
      const bruto = categorias.valor.replace(/^\{|\}$/g, "").trim();
      categorias = bruto ? bruto.split(",") : [];
    } else {
      return { erro: "Categorias devem ser uma lista" };
    }
  }

  if (!Array.isArray(categorias))
    return { erro: "Categorias devem ser uma lista" };

  const lista = [...new Set(categorias.map((c) => String(c).trim().toLowerCase()))];

  if (lista.length === 0)
    return { erro: "Escolha ao menos uma categoria" };

  const invalida = lista.find((c) => !CATEGORIAS_VALIDAS.includes(c));
  if (invalida)
    return { erro: `Categoria inválida: ${invalida}` };

  return { valor: `{${lista.join(",")}}`, lista };
}

// ── Horário de funcionamento ───────────────────────────────────────────
// Guardado como texto com JSON dentro da coluna "mercados.horario":
//   {"1":["08:00","18:00"],"2":["08:00","18:00"]}
// Chave = dia da semana (0 = domingo ... 6 = sábado, igual ao Date do JS).
// Dia ausente da lista = fechado naquele dia. Se a hora de FECHAR for menor
// que a de ABRIR, o mercado atravessa a meia-noite (ex.: 18:00 → 02:00).
// Sem horário (nulo) = loja ainda não configurou; aí o card usa o status.
const RE_HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

function normalizarHorario(horario) {
  // Não enviado = mantém o que já está no banco (edição parcial)
  if (horario === undefined) return { manter: true };
  // Enviado vazio/nulo = loja limpou o horário
  if (horario === null || horario === "") return { valor: null };

  let obj = horario;

  // Revalidação de um payload JÁ normalizado pelo próprio validador:
  // dados_mercado guarda o envelope {valor: '{"1":["08:00","18:00"]}'}
  // e o webhook chama validarDadosMercado de novo em cima dele
  if (typeof obj === "object" && !Array.isArray(obj)) {
    if ("manter" in obj) return { manter: true };
    if ("valor" in obj && Object.keys(obj).length === 1) {
      if (obj.valor === null) return { valor: null };
      obj = obj.valor;
    }
  }

  if (typeof obj === "string") {
    try { obj = JSON.parse(obj); } catch { return { erro: "Horário inválido" }; }
  }
  if (typeof obj !== "object" || Array.isArray(obj))
    return { erro: "Horário deve ser um objeto de dias da semana" };

  const saida = {};
  for (const [dia, faixa] of Object.entries(obj)) {
    if (!/^[0-6]$/.test(dia))
      return { erro: `Dia da semana inválido no horário: ${dia}` };
    if (faixa === null || faixa === undefined) continue; // dia fechado
    if (!Array.isArray(faixa) || faixa.length !== 2)
      return { erro: "Cada dia precisa de abertura e fechamento (HH:MM)" };

    const [abre, fecha] = faixa.map((v) => String(v).trim());
    if (!RE_HORA.test(abre) || !RE_HORA.test(fecha))
      return { erro: "Horários devem estar no formato HH:MM (ex.: 08:00)" };
    if (abre === fecha)
      return { erro: "Abertura e fechamento não podem ser iguais" };

    saida[dia] = [abre, fecha];
  }

  // Sem nenhum dia aberto = tratado como "não configurado"
  return { valor: Object.keys(saida).length > 0 ? JSON.stringify(saida) : null };
}

// ─────────────────────────────────────────────
// Entrega e retirada do mercado (B2):
//   taxa_entrega:   R$ cobrados por entrega (0 = entrega grátis)
//   pedido_minimo:  valor mínimo em produtos para aceitar pedido de entrega
//   oferece_entrega / oferece_retirada: quais formas o mercado aceita
// Campos não enviados ficam como estão no banco (edição parcial).
// ─────────────────────────────────────────────
function normalizarEntrega(body) {
  const saida = { taxa: undefined, minimo: undefined, entrega: undefined, retirada: undefined };
  const { taxa_entrega, pedido_minimo, oferece_entrega, oferece_retirada } = body;

  if (taxa_entrega !== undefined && taxa_entrega !== null && taxa_entrega !== '') {
    const v = Number(taxa_entrega);
    if (!Number.isFinite(v) || v < 0 || v > 9999)
      return { erro: 'Taxa de entrega inválida (use um valor de 0 a 9999).' };
    saida.taxa = v;
  }
  if (pedido_minimo !== undefined && pedido_minimo !== null && pedido_minimo !== '') {
    const v = Number(pedido_minimo);
    if (!Number.isFinite(v) || v < 0 || v > 999999)
      return { erro: 'Pedido mínimo inválido (use um valor de 0 a 999999).' };
    saida.minimo = v;
  }
  if (oferece_entrega !== undefined && oferece_entrega !== null) {
    if (typeof oferece_entrega !== 'boolean')
      return { erro: 'Opção de entrega inválida.' };
    saida.entrega = oferece_entrega;
  }
  if (oferece_retirada !== undefined && oferece_retirada !== null) {
    if (typeof oferece_retirada !== 'boolean')
      return { erro: 'Opção de retirada inválida.' };
    saida.retirada = oferece_retirada;
  }
  return saida;
}

// ─────────────────────────────────────────────
// Valida e normaliza os dados de um mercado.
// Reaproveitado pelo cadastro direto (admin) e pelo checkout do plano
// (payload que só vira mercado DEPOIS que o pagamento confirma).
// ─────────────────────────────────────────────
function validarDadosMercado(dados = {}) {
  const { nome, email, telefone, cnpj, cep, estado, cidade, bairro, rua,
    descricao, paleta, cor_base, cor_destaque, cor_texto, cor_icones,
    cor_texto_sec, plano, categorias, horario,
    taxa_entrega, pedido_minimo, oferece_entrega, oferece_retirada } = dados;

  // Revalidação de payload já normalizado: a entrega vem embutida em
  // dados.entrega {taxa, minimo, entrega, retirada} em vez dos campos soltos
  const entregaFonte = dados.entrega && typeof dados.entrega === 'object'
    ? {
        taxa_entrega:    dados.entrega.taxa,
        pedido_minimo:   dados.entrega.minimo,
        oferece_entrega: dados.entrega.entrega,
        oferece_retirada: dados.entrega.retirada,
      }
    : { taxa_entrega, pedido_minimo, oferece_entrega, oferece_retirada };
  const entrega = normalizarEntrega(entregaFonte);
  if (entrega.erro)
    return { erro: entrega.erro };

  if (!nome || !email || !telefone || !cnpj || !cep || !estado || !cidade || !bairro || !rua)
    return { erro: "Todos os campos são obrigatórios" };

  if (!validarEmailSimples(email))
    return { erro: "Email inválido" };

  if (!validarTelefone(telefone))
    return { erro: "Telefone inválido" };

  if (!validarCNPJ(cnpj))
    return { erro: "CNPJ inválido" };

  if (!validarCEP(cep))
    return { erro: "CEP inválido" };

  const cats = normalizarCategorias(categorias);
  if (cats.erro)
    return { erro: cats.erro };

  const horarioNovo = normalizarHorario(horario);
  if (horarioNovo.erro)
    return { erro: horarioNovo.erro };

  return {
    dados: {
      nome: nome.trim(),
      email: email.trim().toLowerCase(),
      telefone: limparMascara(telefone),
      cnpj: limparMascara(cnpj),
      cep: limparMascara(cep),
      estado: estado.trim().toUpperCase(),
      cidade: cidade.trim(),
      bairro: bairro.trim(),
      rua: rua.trim(),
      descricao: descricao?.trim() || null,
      paleta: paleta ?? 'classico',
      cor_base: cor_base ?? '',
      cor_destaque: cor_destaque ?? '',
      cor_texto: cor_texto ?? '',
      cor_icones: cor_icones ?? '',
      cor_texto_sec: cor_texto_sec ?? '',
      plano: normalizarPlano(plano),
      cats,
      horario: horarioNovo,
      entrega,
    },
  };
}

// ─────────────────────────────────────────────
// Cria o mercado a partir de dados JÁ validados (ver validarDadosMercado).
// Usado pelo cadastro direto (admin) e pela confirmação de pagamento
// (webhook do Asaas / recuperação em /api/assinaturas/minha).
// Lança Error com .status em conflito.
// ─────────────────────────────────────────────
async function criarMercadoCompleto(sql, id_usuario, d) {
  // Duplicidade de CNPJ ou email — se já for DO PRÓPRIO usuário, devolve o
  // mercado dele (a recuperação de pagamento não pode gerar loja duplicada)
  const existente = await sql`
    SELECT m.id_mercado, um.id_usuario AS dono_id
    FROM mercados m
    LEFT JOIN usuarios_mercados um ON um.id_mercado = m.id_mercado AND um.papel = 'dono'
    WHERE m.cnpj = ${d.cnpj} OR m.email = ${d.email}
  `;

  if (existente.length > 0) {
    const todosDoUsuario = existente.every(
      (e) => e.dono_id != null && Number(e.dono_id) === Number(id_usuario)
    );
    if (todosDoUsuario) {
      const [jaExistente] = await sql`
        SELECT * FROM mercados WHERE id_mercado = ${existente[0].id_mercado}
      `;
      await sql`
        INSERT INTO usuarios_mercados (id_usuario, id_mercado, papel)
        SELECT ${id_usuario}, ${jaExistente.id_mercado}, 'dono'
        WHERE NOT EXISTS (
          SELECT 1 FROM usuarios_mercados
          WHERE id_usuario = ${id_usuario} AND id_mercado = ${jaExistente.id_mercado}
        )
      `;
      return jaExistente;
    }
    const erro = new Error("CNPJ ou email já cadastrado");
    erro.status = 409;
    throw erro;
  }

  // Gera slug único
  let slug = gerarSlug(d.nome);
  const slugExistente = await sql`
    SELECT id_mercado FROM mercados WHERE slug = ${slug}
  `;
  if (slugExistente.length > 0) {
    slug = `${slug}-${Date.now()}`;
  }

  // Cria o mercado
  const [novoMercado] = await sql`
    INSERT INTO mercados (nome, email, telefone, cnpj, cep, estado, cidade, bairro, rua, descricao, slug, paleta, cor_base, cor_destaque, cor_texto, cor_icones, cor_texto_sec, plano, categorias, horario, taxa_entrega, pedido_minimo, oferece_entrega, oferece_retirada)
    VALUES (
      ${d.nome},
      ${d.email},
      ${d.telefone},
      ${d.cnpj},
      ${d.cep},
      ${d.estado},
      ${d.cidade},
      ${d.bairro},
      ${d.rua},
      ${d.descricao},
      ${slug},
      ${d.paleta},
      ${d.cor_base},
      ${d.cor_destaque},
      ${d.cor_texto},
      ${d.cor_icones},
      ${d.cor_texto_sec},
      ${d.plano},
      ${d.cats.valor},
      ${d.horario?.valor ?? null},
      ${Number(d.entrega?.taxa ?? 0).toFixed(2)},
      ${Number(d.entrega?.minimo ?? 0).toFixed(2)},
      ${d.entrega?.entrega ?? true},
      ${d.entrega?.retirada ?? true}
    )
    RETURNING *
  `;

  // Vincula o mercado ao usuário com papel 'dono'
  await sql`
    INSERT INTO usuarios_mercados (id_usuario, id_mercado, papel)
    VALUES (${id_usuario}, ${novoMercado.id_mercado}, 'dono')
  `;

  // Categorias reais da vitrine: cada tipo escolhido vira uma linha na
  // tabela "categorias" — é daí que a página do mercado lê as abas de
  // produtos. Sem isso a vitrine do mercado novo ficava sempre vazia.
  if (d.cats.lista.length > 0) {
    const nomesBonitos = d.cats.lista.map((c) => LABELS_CATEGORIAS[c] ?? c);
    const linhasCategorias = await sql`
      INSERT INTO categorias (id_mercado, nome)
      SELECT ${novoMercado.id_mercado}, UNNEST(${nomesBonitos}::text[])
      RETURNING id_categoria
    `;

    // Semente de demonstração: cada categoria ganha um produto de teste,
    // para a vitrine já abrir com conteúdo. O vendedor edita ou apaga e
    // cadastra os produtos reais em seguida.
    if (linhasCategorias.length > 0) {
      await sql`
        INSERT INTO produtos (nome, descricao, id_categoria, preco, estoque)
        SELECT
          'Cesta de demonstração — ' || initcap(c.nome),
          'Produto criado automaticamente no cadastro. Edite ou apague e cadastre seus produtos reais.',
          c.id_categoria,
          ROUND((2 + random() * 28)::numeric, 2),
          20 + floor(random() * 80)::int
        FROM categorias c
        WHERE c.id_mercado = ${novoMercado.id_mercado}
      `;
    }
  }

  return novoMercado;
}

// ─────────────────────────────────────────────
// POST /api/mercados — Criar novo mercado
// Só o admin cria direto pela API; o usuário comum cria apenas após a
// confirmação do pagamento (webhook do Asaas ou /api/assinaturas/minha).
// ─────────────────────────────────────────────
const criarMercado = async (req, res) => {
  const id_usuario = req.usuarioId;

  try {
    const sql = await conectar();

    const [usuario] = await sql`
      SELECT is_admin FROM usuarios WHERE id_usuario = ${id_usuario}
    `;
    if (!usuario?.is_admin) {
      return res.status(403).json({
        erro: "Seu mercado será criado assim que o pagamento for confirmado.",
      });
    }

    const validacao = validarDadosMercado(req.body);
    if (validacao.erro)
      return res.status(400).json({ erro: validacao.erro });

    const novoMercado = await criarMercadoCompleto(sql, id_usuario, validacao.dados);

    res.status(201).json({
      mensagem: "Mercado criado com sucesso!",
      mercado: novoMercado,
    });
  } catch (err) {
    if (err.status === 409) {
      return res.status(409).json({ erro: err.message });
    }
    console.error("ERRO criarMercado:", err);
    res.status(500).json({ erro: err.message });
  }
};

// ─────────────────────────────────────────────
// GET /api/mercados — Listar todos os mercados
// Rota pública — suporta paginação via query params ?page=1&limit=20
// ─────────────────────────────────────────────

const listarMercados = async (req, res) => {
  try {
    const sql = await conectar();

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;

    // Busca por nome/slug/cidade/estado (usada na home e no modal de favoritos).
    // O sem_acento deixa "Jose" achar "José" — muita gente digita sem acento.
    const termo = (req.query.busca ?? '').trim();
    const filtro = termo || null;

    const [mercados, [{ total }], [{ totalPedidos }]] = await Promise.all([
      sql`
        SELECT m.*,
          COALESCE(AVG(a.nota), 0)::float8 AS avaliacao,
          COUNT(a.id)::int AS avaliacoes_count
        FROM mercados m
        LEFT JOIN avaliacoes a ON a.id_mercado = m.id_mercado
        WHERE m.status = 'ativo'
          AND (
            ${filtro}::text IS NULL
            OR sem_acento(m.nome)   ILIKE '%' || sem_acento(${filtro}::text) || '%'
            OR sem_acento(m.slug)   ILIKE '%' || sem_acento(${filtro}::text) || '%'
            OR sem_acento(m.cidade) ILIKE '%' || sem_acento(${filtro}::text) || '%'
            OR sem_acento(m.estado) ILIKE '%' || sem_acento(${filtro}::text) || '%'
          )
        GROUP BY m.id_mercado
        ORDER BY
          -- Ordem da home: 1) mercado em destaque (o da equipe, configurável
          -- via MERCADO_DESTAQUE), 2) melhor nota, 3) mais recente
          CASE WHEN m.slug = ${process.env.MERCADO_DESTAQUE || 'supermercado-bom-preco'} THEN 0 ELSE 1 END,
          avaliacao DESC,
          m.data_cadastro DESC
        LIMIT ${limit} OFFSET ${offset}
      `,
      sql`
        SELECT COUNT(*)::int AS total FROM mercados m
        WHERE m.status = 'ativo'
          AND (
            ${filtro}::text IS NULL
            OR sem_acento(m.nome)   ILIKE '%' || sem_acento(${filtro}::text) || '%'
            OR sem_acento(m.slug)   ILIKE '%' || sem_acento(${filtro}::text) || '%'
            OR sem_acento(m.cidade) ILIKE '%' || sem_acento(${filtro}::text) || '%'
            OR sem_acento(m.estado) ILIKE '%' || sem_acento(${filtro}::text) || '%'
          )
      `,
      sql`SELECT COUNT(*)::int AS "totalPedidos" FROM historico_compras`
    ]);

    res.status(200).json({
      mercados,
      paginacao: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      },
      stats: {
        totalMercados: total,
        totalPedidos
      }
    });
  } catch (err) {
    console.error("ERRO listarMercados:", err);
    res.status(500).json({ erro: err.message });
  }
};

// ─────────────────────────────────────────────
// GET /api/mercados/:id — Buscar mercado por ID
// ─────────────────────────────────────────────

const buscarMercadoPorId = async (req, res) => {
  const { id } = req.params;
  const id_usuario = req.usuarioId ?? null;

  try {
    const sql = await conectar();

    const [mercado] = await sql`
      SELECT m.*,
        EXISTS(
          SELECT 1 FROM favoritos f
          WHERE f.id_mercado = m.id_mercado AND f.id_usuario = ${id_usuario}
        ) AS favoritado,
        COALESCE(AVG(a.nota), 0)::float8 AS avaliacao,
        COUNT(a.id)::int AS avaliacoes_count
      FROM mercados m
      LEFT JOIN avaliacoes a ON a.id_mercado = m.id_mercado
      WHERE m.id_mercado = ${Number(id)}
      GROUP BY m.id_mercado
    `;

    if (!mercado)
      return res.status(404).json({ erro: "Mercado não encontrado" });

    res.status(200).json({ mercado });
  } catch (err) {
    console.error("ERRO buscarMercadoPorId:", err);
    res.status(500).json({ erro: err.message });
  }
};

// ─────────────────────────────────────────────
// GET /api/mercados/slug/:slug — Buscar mercado por slug
// ─────────────────────────────────────────────

const buscarMercadoPorSlug = async (req, res) => {
  const { slug } = req.params;
  const id_usuario = req.usuarioId ?? null;

  try {
    const sql = await conectar();

    const [mercado] = await sql`
      SELECT m.*,
        EXISTS(
          SELECT 1 FROM favoritos f
          WHERE f.id_mercado = m.id_mercado AND f.id_usuario = ${id_usuario}
        ) AS favoritado,
        COALESCE(AVG(a.nota), 0)::float8 AS avaliacao,
        COUNT(a.id)::int AS avaliacoes_count
      FROM mercados m
      LEFT JOIN avaliacoes a ON a.id_mercado = m.id_mercado
      WHERE m.slug = ${slug}
      GROUP BY m.id_mercado
    `;

    if (!mercado)
      return res.status(404).json({ erro: "Mercado não encontrado" });

    res.status(200).json({ mercado });
  } catch (err) {
    console.error("ERRO buscarMercadoPorSlug:", err);
    res.status(500).json({ erro: err.message });
  }
};

// ─────────────────────────────────────────────
// PUT /api/mercados/:id — Atualizar mercado
// Só dono ou admin do mercado pode atualizar
// ─────────────────────────────────────────────

const atualizarMercado = async (req, res) => {
  const id_usuario = req.usuarioId;
  if (!id_usuario)
    return res.status(401).json({ erro: "Não autenticado" });

  const { id } = req.params;
  const { nome, email, telefone, cnpj, cep, estado, cidade, bairro, rua, descricao, paleta, cor_base, cor_destaque, cor_texto, cor_icones, cor_texto_sec, banner_url, foto_perfil_url, categorias, horario, custos_fixos, taxa_entrega, pedido_minimo, oferece_entrega, oferece_retirada } = req.body;

  const banner = banner_url || undefined
  const foto_perfil = foto_perfil_url || undefined

  if (email && !validarEmailSimples(email))
    return res.status(400).json({ erro: "Email inválido" });

  if (telefone && !validarTelefone(telefone))
    return res.status(400).json({ erro: "Telefone inválido" });

  if (cnpj && !validarCNPJ(cnpj))
    return res.status(400).json({ erro: "CNPJ inválido" });

  if (cep && !validarCEP(cep))
    return res.status(400).json({ erro: "CEP inválido" });

  // Custos fixos mensais (aluguel, luz, salários): opcional; quando vier,
  // precisa ser um número >= 0. Quem não enviu mantém o valor do banco.
  let custosFixosNovo = undefined;
  if (custos_fixos !== undefined && custos_fixos !== null) {
    const v = Number(custos_fixos);
    if (!Number.isFinite(v) || v < 0 || v > 99999999)
      return res.status(400).json({ erro: "Custos fixos inválidos" });
    custosFixosNovo = v;
  }

  // Entrega e retirada (taxa, mínimo e opções) — mesmo critério dos custos
  const entregaEdicao = normalizarEntrega({ taxa_entrega, pedido_minimo, oferece_entrega, oferece_retirada });
  if (entregaEdicao.erro)
    return res.status(400).json({ erro: entregaEdicao.erro });

  const catsEdicao = normalizarCategorias(categorias);
  if (catsEdicao.erro)
    return res.status(400).json({ erro: catsEdicao.erro });

  const horarioEdicao = normalizarHorario(horario);
  if (horarioEdicao.erro)
    return res.status(400).json({ erro: horarioEdicao.erro });

  try {
    const sql = await conectar();

    const [permissao] = await sql`
      SELECT papel FROM usuarios_mercados
      WHERE id_usuario = ${id_usuario}
        AND id_mercado = ${Number(id)}
    `;

    if (!permissao)
      return res.status(403).json({ erro: "Você não tem acesso a este mercado" });

    if (!["dono", "admin"].includes(permissao.papel))
      return res.status(403).json({ erro: "Apenas o dono ou admin pode editar o mercado" });

    const [existente] = await sql`
      SELECT id_mercado FROM mercados
      WHERE id_mercado = ${Number(id)}
    `;

    if (!existente)
      return res.status(404).json({ erro: "Mercado não encontrado" });

    // Horário numa atualização à parte: ele pode ser limpo (valor nulo) e o
    // COALESCE do UPDATE principal não distinguiria "não enviou" de "limpou".
    // Quando não veio o campo (edição de outra seção), mantém o banco.
    if (!horarioEdicao.manter) {
      await sql`
        UPDATE mercados SET horario = ${horarioEdicao.valor ?? null}
        WHERE id_mercado = ${Number(id)}
      `;
    }

    let slugAtualizado = undefined;
    if (nome?.trim()) {
      let slug = gerarSlug(nome);
      const slugExistente = await sql`
        SELECT id_mercado FROM mercados WHERE slug = ${slug} AND id_mercado != ${Number(id)}
      `;
      if (slugExistente.length > 0) {
        slug = `${slug}-${Date.now()}`;
      }
      slugAtualizado = slug;
    }

    const [mercadoAtualizado] = await sql`
      UPDATE mercados SET
        nome        = COALESCE(${nome?.trim()                       ?? null}, nome),
        email       = COALESCE(${email?.trim().toLowerCase()        ?? null}, email),
        telefone    = COALESCE(${telefone ? limparMascara(telefone) : null}, telefone),
        cnpj        = COALESCE(${cnpj    ? limparMascara(cnpj)      : null}, cnpj),
        cep         = COALESCE(${cep     ? limparMascara(cep)       : null}, cep),
        estado      = COALESCE(${estado?.trim().toUpperCase()       ?? null}, estado),
        cidade      = COALESCE(${cidade?.trim()                     ?? null}, cidade),
        bairro      = COALESCE(${bairro?.trim()                     ?? null}, bairro),
        rua         = COALESCE(${rua?.trim()                        ?? null}, rua),
        descricao   = COALESCE(${descricao?.trim()                  ?? null}, descricao),
        slug        = COALESCE(${slugAtualizado ?? null}, slug),
        paleta      = COALESCE(${paleta ?? null}, paleta),
        cor_base    = COALESCE(${cor_base ?? null}, cor_base),
        cor_destaque = COALESCE(${cor_destaque ?? null}, cor_destaque),
        cor_texto   = COALESCE(${cor_texto ?? null}, cor_texto),
        cor_icones  = COALESCE(${cor_icones ?? null}, cor_icones),
        cor_texto_sec = COALESCE(${cor_texto_sec ?? null}, cor_texto_sec),
        banner       = COALESCE(${banner ?? null}, banner),
        foto_perfil  = COALESCE(${foto_perfil ?? null}, foto_perfil),
        custos_fixos = COALESCE(${custosFixosNovo ?? null}, custos_fixos),
        taxa_entrega = COALESCE(${entregaEdicao.taxa ?? null}, taxa_entrega),
        pedido_minimo = COALESCE(${entregaEdicao.minimo ?? null}, pedido_minimo),
        oferece_entrega = COALESCE(${entregaEdicao.entrega ?? null}, oferece_entrega),
        oferece_retirada = COALESCE(${entregaEdicao.retirada ?? null}, oferece_retirada),
        categorias   = COALESCE(${catsEdicao.valor}, categorias)
      WHERE id_mercado = ${Number(id)}
      RETURNING *
    `;

    res.status(200).json({
      mensagem: "Mercado atualizado com sucesso!",
      mercado: mercadoAtualizado,
    });
  } catch (err) {
    console.error("ERRO atualizarMercado:", err);
    res.status(500).json({ erro: err.message });
  }
};

// ─────────────────────────────────────────────
// DELETE /api/mercados/:id — Deletar mercado
// Só o dono pode deletar
// ─────────────────────────────────────────────

const deletarMercado = async (req, res) => {
  const id_usuario = req.usuarioId;
  if (!id_usuario)
    return res.status(401).json({ erro: "Não autenticado" });

  const { id } = req.params;

  try {
    const sql = await conectar();

    const [permissao] = await sql`
      SELECT papel FROM usuarios_mercados
      WHERE id_usuario = ${id_usuario}
        AND id_mercado = ${Number(id)}
    `;

    if (!permissao)
      return res.status(403).json({ erro: "Você não tem acesso a este mercado" });

    if (permissao.papel !== "dono")
      return res.status(403).json({ erro: "Apenas o dono pode deletar o mercado" });

    const [existente] = await sql`
      SELECT id_mercado FROM mercados
      WHERE id_mercado = ${Number(id)}
    `;

    if (!existente)
      return res.status(404).json({ erro: "Mercado não encontrado" });

    // Remove tudo na ordem das chaves estrangeiras (do filho pro pai).
    // carrinho e mercado_produtos apontam para mercado E produto; depois
    // vêm pedidos, avaliações e afins; por último categorias, produtos e o
    // próprio mercado. Sem essa ordem o banco recusa o DELETE (constraint).
    const idNum = Number(id);
    await sql`DELETE FROM carrinho           WHERE id_mercado = ${idNum}`;
    await sql`DELETE FROM mercado_produtos   WHERE id_mercado = ${idNum}`;
    await sql`DELETE FROM pedido_mercados    WHERE id_mercado = ${idNum}`;
    await sql`DELETE FROM historico_compras  WHERE id_mercado = ${idNum}`;
    await sql`DELETE FROM favoritos          WHERE id_mercado = ${idNum}`;
    await sql`DELETE FROM avaliacoes         WHERE id_mercado = ${idNum}`;
    await sql`DELETE FROM avaliacoes_mercado WHERE id_mercado = ${idNum}`;
    await sql`DELETE FROM assinaturas        WHERE id_mercado = ${idNum}`;
    await sql`DELETE FROM posts_mercado      WHERE id_mercado = ${idNum}`;
    await sql`DELETE FROM produtos WHERE id_categoria IN (SELECT id_categoria FROM categorias WHERE id_mercado = ${idNum})`;
    await sql`DELETE FROM categorias         WHERE id_mercado = ${idNum}`;
    await sql`DELETE FROM usuarios_mercados  WHERE id_mercado = ${idNum}`;
    await sql`DELETE FROM mercados           WHERE id_mercado = ${idNum}`;

    res.status(200).json({ mensagem: "Mercado deletado com sucesso" });
  } catch (err) {
    console.error("ERRO deletarMercado:", err);
    res.status(500).json({ erro: err.message });
  }
};
// GET /api/meus-mercados — mercados do usuário logado
const meusMercados = async (req, res) => {
  const id_usuario = req.usuarioId;
  if (!id_usuario)
    return res.status(401).json({ erro: "Não autenticado" });

  try {
    const sql = await conectar();
    const mercados = await sql`
      SELECT m.* FROM mercados m
      INNER JOIN usuarios_mercados um ON um.id_mercado = m.id_mercado
      WHERE um.id_usuario = ${id_usuario}
      ORDER BY m.data_cadastro DESC
    `;
    res.status(200).json({ mercados });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
};


// GET /api/mercados/:id/dashboard — dados completos para o gerenciamento
const dashboardMercado = async (req, res) => {
  const id_usuario = req.usuarioId;
  if (!id_usuario)
    return res.status(401).json({ erro: "Não autenticado" });

  const { id } = req.params;

  try {
    const sql = await conectar();

    // Verifica permissão
    const [permissao] = await sql`
      SELECT papel FROM usuarios_mercados
      WHERE id_usuario = ${id_usuario}
        AND id_mercado = ${Number(id)}
    `;
    if (!permissao)
      return res.status(403).json({ erro: "Você não tem acesso a este mercado" });

    // Busca dados do mercado
    const [mercado] = await sql`
      SELECT * FROM mercados WHERE id_mercado = ${Number(id)}
    `;
    if (!mercado)
      return res.status(404).json({ erro: "Mercado não encontrado" });

    // Busca todos os produtos do mercado (via categorias)
    const produtos = await sql`
      SELECT p.id_produto, p.nome, p.descricao, p.imagem, p.preco, p.custo, p.estoque, p.imagens, p.id_categoria, c.nome AS categoria
      FROM produtos p
      JOIN categorias c ON c.id_categoria = p.id_categoria
      WHERE c.id_mercado = ${Number(id)}
      ORDER BY p.id_produto
    `;

    // Contagem de categorias
    const [catCount] = await sql`
      SELECT COUNT(*)::int AS total FROM categorias WHERE id_mercado = ${Number(id)}
    `;

    // Limites do plano e uso atual (produtos e fotos)
    const limites = limitesDoPlano(mercado.plano);
    const totalFotos = produtos.reduce(
      (soma, p) => soma + (Array.isArray(p.imagens) ? p.imagens.length : 0), 0
    );

    // Resumo de estoque: produtos sem estoque (0) e estoque baixo (até 5)
    const semEstoque   = produtos.filter(p => (Number(p.estoque) || 0) <= 0).length;
    const estoqueBaixo = produtos.filter(p => {
      const e = Number(p.estoque) || 0;
      return e > 0 && e <= 5;
    }).length;

    // Avaliação média do mercado
    const [avaliacao] = await sql`
      SELECT COALESCE(AVG(a.nota), 0)::numeric(2,1) AS media, COUNT(a.id)::int AS total
      FROM avaliacoes a
      WHERE a.id_mercado = ${Number(id)}
    `;

    // Pedidos e receita de hoje
    const [hoje] = await sql`
      SELECT COUNT(*)::int AS pedidos, COALESCE(SUM(valor_total), 0)::numeric(12,2) AS receita
      FROM historico_compras
      WHERE id_mercado = ${Number(id)}
        AND data_compra::date = CURRENT_DATE
    `;

    res.status(200).json({
      mercado,
      produtos,
      totalCategorias: catCount.total,
      totalProdutos: produtos.length,
      plano: mercado.plano || 'basico',
      limites,
      uso: {
        produtos: produtos.length,
        fotos: totalFotos,
      },
      resumo: {
        semEstoque,
        estoqueBaixo,
        avaliacaoMedia: Number(avaliacao.media),
        avaliacoesTotal: avaliacao.total,
        pedidosHoje: hoje.pedidos,
        receitaHoje: Number(hoje.receita),
      },
    });
  } catch (err) {
    console.error("ERRO dashboardMercado:", err);
    res.status(500).json({ erro: err.message });
  }
};

module.exports = {
  criarMercado,
  listarMercados,
  buscarMercadoPorId,
  buscarMercadoPorSlug,
  atualizarMercado,
  deletarMercado,
  meusMercados,
  dashboardMercado,
  validarDadosMercado,
  criarMercadoCompleto,
};
