const { conectar } = require('../db/neon');

// ─────────────────────────────────────────────────────────────────────────────
//  Cupons de desconto (B3)
//  Cada mercado cria os seus cupons no painel do vendedor. No carrinho, o
//  cliente informa o código e o backend confere se ainda vale (ativo, não
//  expirado, limite de usos, pedido mínimo) e calcula o desconto — o valor
//  nunca sai do navegador.
//  tipo: 'percentual' (10 = 10%) ou 'valor' (10 = R$ 10,00)
//
//  Escopo (B10): o vendedor pode escolher em quais CATEGORIAS de produtos o
//  cupom vale. Sem escolher nenhuma, o cupom continua valendo para o pedido
//  inteiro (comportamento antigo). O desconto de cupom com escopo é calculado
//  só em cima do valor dos produtos das categorias escolhidas.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Lê a lista de categorias vinda da tela.
 * Devolve `null` quando o campo não veio (não mexe nas categorias) ou uma
 * lista de ids inteiros (pode ficar vazia = cupom vale para tudo).
 */
function lerCategorias(categorias) {
  if (categorias === undefined || categorias === null) return null;
  if (!Array.isArray(categorias)) return { erro: 'Categorias do cupom inválidas.' };

  const ids = [];
  for (const bruto of categorias) {
    const id = Number(bruto);
    if (!Number.isInteger(id) || id <= 0) {
      return { erro: 'Categoria do cupom inválida.' };
    }
    if (!ids.includes(id)) ids.push(id);
    if (ids.length > 20) {
      return { erro: 'Um cupom pode cobrir no máximo 20 categorias.' };
    }
  }
  return { ids };
}

/** Monta o desconto de um cupom sobre a base informada */
function calcularDesconto(cupom, base) {
  const bruto = cupom.tipo === 'percentual'
    ? base * (Number(cupom.valor) / 100)
    : Number(cupom.valor);
  return Math.round(Math.min(bruto, base) * 100) / 100;
}

/** Devolve [{ id, nomes }] das categorias informadas (para responder à tela) */
async function buscarNomes(sql, categorias) {
  if (!categorias || categorias.length === 0) return [];
  const linhas = await sql`
    SELECT id_categoria, nome FROM categorias
    WHERE id_categoria = ANY(${categorias})
    ORDER BY nome ASC
  `;
  return linhas.map((l) => ({ id: Number(l.id_categoria), nome: l.nome }));
}

/** Lista as categorias (ids + nomes) ligadas a cada cupom */
async function categoriasPorCupom(sql, cupons) {
  if (cupons.length === 0) return new Map();

  const linhas = await sql`
    SELECT cc.id_cupom, c.id_categoria, c.nome
    FROM cupom_categorias cc
    JOIN categorias c ON c.id_categoria = cc.id_categoria
    WHERE cc.id_cupom = ANY(${cupons.map((c) => c.id)})
    ORDER BY c.nome ASC
  `;

  const mapa = new Map();
  for (const linha of linhas) {
    const id = Number(linha.id_cupom);
    if (!mapa.has(id)) mapa.set(id, []);
    mapa.get(id).push({ id: Number(linha.id_categoria), nome: linha.nome });
  }
  return mapa;
}

// Confere se o usuário logado gerencia o mercado (dono ou admin)
async function podeGerenciar(sql, idUsuario, mercadoId) {
  const [permissao] = await sql`
    SELECT papel FROM usuarios_mercados
    WHERE id_usuario = ${idUsuario} AND id_mercado = ${mercadoId}
  `;
  return !!permissao && ['dono', 'admin'].includes(permissao.papel);
}

// Valida os campos do cupom na entrada (criação e edição)
function validarCupom(body) {
  const { codigo, tipo, valor, min_pedido, max_usos, validade } = body;

  const codigoLimpo = typeof codigo === 'string' ? codigo.trim().toUpperCase().slice(0, 30) : '';
  if (!/^[A-Z0-9_-]{3,30}$/.test(codigoLimpo)) {
    return { erro: 'Código do cupom inválido: use de 3 a 30 letras, números, "-" ou "_".' };
  }

  if (tipo !== 'percentual' && tipo !== 'valor') {
    return { erro: 'Tipo do cupom inválido: use "percentual" ou "valor".' };
  }

  const valorNum = Number(valor);
  if (!Number.isFinite(valorNum) || valorNum <= 0 || valorNum > 100000) {
    return { erro: 'Valor do cupom inválido.' };
  }
  if (tipo === 'percentual' && valorNum > 100) {
    return { erro: 'Cupom percentual não pode passar de 100%.' };
  }

  let minimo = 0;
  if (min_pedido !== undefined && min_pedido !== null && min_pedido !== '') {
    minimo = Number(min_pedido);
    if (!Number.isFinite(minimo) || minimo < 0 || minimo > 999999) {
      return { erro: 'Pedido mínimo do cupom inválido.' };
    }
  }

  let usosMax = null;
  if (max_usos !== undefined && max_usos !== null && max_usos !== '') {
    usosMax = Number(max_usos);
    if (!Number.isInteger(usosMax) || usosMax <= 0 || usosMax > 1000000) {
      return { erro: 'Limite de usos inválido.' };
    }
  }

  let validadeData = null;
  if (validade !== undefined && validade !== null && validade !== '') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(validade).trim())) {
      return { erro: 'Validade inválida — use o formato AAAA-MM-DD.' };
    }
    validadeData = String(validade).trim();
  }

  return { codigo: codigoLimpo, tipo, valor: valorNum, minimo, usosMax, validadeData };
}

function formatarCupom(c, categorias = []) {
  return {
    id: c.id,
    codigo: c.codigo,
    tipo: c.tipo,
    valor: Number(c.valor),
    minPedido: Number(c.min_pedido) || 0,
    maxUsos: c.max_usos == null ? null : Number(c.max_usos),
    usos: Number(c.usos) || 0,
    validade: c.validade || null,
    ativo: c.ativo !== false,
    criadoEm: c.criado_em,
    // Categorias em que o cupom vale (lista vazia = vale para tudo)
    categorias: Array.isArray(categorias) ? categorias : [],
  };
}

// GET /api/mercados/:id/cupons — lista os cupons do mercado (vendedor)
const listarCupons = async (req, res) => {
  const idUsuario = req.usuarioId;
  const mercadoId = Number(req.params.id);

  if (!Number.isInteger(mercadoId) || mercadoId <= 0) {
    return res.status(400).json({ erro: 'Mercado inválido.' });
  }

  try {
    const sql = await conectar();
    if (!(await podeGerenciar(sql, idUsuario, mercadoId))) {
      return res.status(403).json({ erro: 'Você não tem acesso aos cupons deste mercado.' });
    }

    const cupons = await sql`
      SELECT * FROM cupons WHERE id_mercado = ${mercadoId}
      ORDER BY ativo DESC, criado_em DESC
      LIMIT 200
    `;
    const categorias = await categoriasPorCupom(sql, cupons);
    res.status(200).json({
      cupons: cupons.map((c) => formatarCupom(c, categorias.get(Number(c.id)) ?? [])),
    });
  } catch (err) {
    console.error('ERRO listarCupons:', err);
    res.status(500).json({ erro: 'Não foi possível carregar os cupons.' });
  }
};

// POST /api/mercados/:id/cupons — cria um cupom (vendedor)
const criarCupom = async (req, res) => {
  const idUsuario = req.usuarioId;
  const mercadoId = Number(req.params.id);

  if (!Number.isInteger(mercadoId) || mercadoId <= 0) {
    return res.status(400).json({ erro: 'Mercado inválido.' });
  }

  const dados = validarCupom(req.body);
  if (dados.erro) return res.status(400).json({ erro: dados.erro });

  // Escopo: em quais categorias de produtos este cupom vale (opcional)
  const escopo = lerCategorias(req.body.categorias);
  if (escopo && escopo.erro) return res.status(400).json({ erro: escopo.erro });

  try {
    const sql = await conectar();
    if (!(await podeGerenciar(sql, idUsuario, mercadoId))) {
      return res.status(403).json({ erro: 'Você não tem acesso aos cupons deste mercado.' });
    }

    // As categorias escolhidas precisam ser do mercado em questão
    if (escopo && escopo.ids.length > 0) {
      const doMercado = await sql`
        SELECT id_categoria FROM categorias
        WHERE id_mercado = ${mercadoId} AND id_categoria = ANY(${escopo.ids})
      `;
      if (doMercado.length !== escopo.ids.length) {
        return res.status(400).json({ erro: 'Uma das categorias informadas não pertence a este mercado.' });
      }
    }

    const existente = await sql`
      SELECT 1 FROM cupons WHERE id_mercado = ${mercadoId} AND codigo = ${dados.codigo}
    `;
    if (existente.length > 0) {
      return res.status(409).json({ erro: `Já existe um cupom com o código "${dados.codigo}" neste mercado.` });
    }

    const [novo] = await sql`
      INSERT INTO cupons (id_mercado, codigo, tipo, valor, min_pedido, max_usos, validade, ativo)
      VALUES (${mercadoId}, ${dados.codigo}, ${dados.tipo}, ${dados.valor.toFixed(2)},
              ${dados.minimo.toFixed(2)}, ${dados.usosMax}, ${dados.validadeData}, TRUE)
      RETURNING *
    `;

    const categorias = escopo?.ids ?? [];
    for (const idCategoria of categorias) {
      await sql`
        INSERT INTO cupom_categorias (id_cupom, id_categoria)
        VALUES (${novo.id}, ${idCategoria})
      `;
    }

    res.status(201).json({
      mensagem: 'Cupom criado com sucesso.',
      cupom: formatarCupom(novo, await buscarNomes(sql, categorias)),
    });
  } catch (err) {
    console.error('ERRO criarCupom:', err);
    res.status(500).json({ erro: 'Não foi possível criar o cupom.' });
  }
};

// PUT /api/mercados/:id/cupons/:cupomId — edição (valor, mínimo, usos, validade, ativo)
const atualizarCupom = async (req, res) => {
  const idUsuario = req.usuarioId;
  const mercadoId = Number(req.params.id);
  const cupomId = Number(req.params.cupomId);

  if (!Number.isInteger(mercadoId) || mercadoId <= 0 ||
      !Number.isInteger(cupomId) || cupomId <= 0) {
    return res.status(400).json({ erro: 'Cupom inválido.' });
  }

  try {
    const sql = await conectar();
    if (!(await podeGerenciar(sql, idUsuario, mercadoId))) {
      return res.status(403).json({ erro: 'Você não tem acesso aos cupons deste mercado.' });
    }

    const [atual] = await sql`
      SELECT * FROM cupons WHERE id = ${cupomId} AND id_mercado = ${mercadoId}
    `;
    if (!atual) return res.status(404).json({ erro: 'Cupom não encontrado.' });

    // O código não muda (é como o cliente digita); mudam valor, mínimo, usos,
    // validade e se está ativo ou não.
    const dados = validarCupom({
      codigo: atual.codigo,
      tipo: req.body.tipo ?? atual.tipo,
      valor: req.body.valor ?? atual.valor,
      min_pedido: req.body.min_pedido ?? atual.min_pedido,
      max_usos: req.body.max_usos ?? atual.max_usos,
      validade: req.body.validade ?? atual.validade,
    });
    if (dados.erro) return res.status(400).json({ erro: dados.erro });

    // Escopo: quando vem lista de categorias, substitui a que estava lá
    const escopo = lerCategorias(req.body.categorias);
    if (escopo && escopo.erro) return res.status(400).json({ erro: escopo.erro });

    if (escopo && escopo.ids.length > 0) {
      const doMercado = await sql`
        SELECT id_categoria FROM categorias
        WHERE id_mercado = ${mercadoId} AND id_categoria = ANY(${escopo.ids})
      `;
      if (doMercado.length !== escopo.ids.length) {
        return res.status(400).json({ erro: 'Uma das categorias informadas não pertence a este mercado.' });
      }
    }

    const ativo = typeof req.body.ativo === 'boolean' ? req.body.ativo : atual.ativo;

    const [atualizado] = await sql`
      UPDATE cupons SET
        tipo = ${dados.tipo},
        valor = ${dados.valor.toFixed(2)},
        min_pedido = ${dados.minimo.toFixed(2)},
        max_usos = ${dados.usosMax},
        validade = ${dados.validadeData},
        ativo = ${ativo}
      WHERE id = ${cupomId}
      RETURNING *
    `;

    let categorias = (await categoriasPorCupom(sql, [atual])).get(Number(cupomId)) ?? [];
    if (escopo) {
      await sql`DELETE FROM cupom_categorias WHERE id_cupom = ${cupomId}`;
      for (const idCategoria of escopo.ids) {
        await sql`
          INSERT INTO cupom_categorias (id_cupom, id_categoria)
          VALUES (${cupomId}, ${idCategoria})
        `;
      }
      categorias = await buscarNomes(sql, escopo.ids);
    }

    res.status(200).json({
      mensagem: 'Cupom atualizado com sucesso.',
      cupom: formatarCupom(atualizado, categorias),
    });
  } catch (err) {
    console.error('ERRO atualizarCupom:', err);
    res.status(500).json({ erro: 'Não foi possível atualizar o cupom.' });
  }
};

// DELETE /api/mercados/:id/cupons/:cupomId — apaga o cupom
const deletarCupom = async (req, res) => {
  const idUsuario = req.usuarioId;
  const mercadoId = Number(req.params.id);
  const cupomId = Number(req.params.cupomId);

  if (!Number.isInteger(mercadoId) || mercadoId <= 0 ||
      !Number.isInteger(cupomId) || cupomId <= 0) {
    return res.status(400).json({ erro: 'Cupom inválido.' });
  }

  try {
    const sql = await conectar();
    if (!(await podeGerenciar(sql, idUsuario, mercadoId))) {
      return res.status(403).json({ erro: 'Você não tem acesso aos cupons deste mercado.' });
    }

    const [apagado] = await sql`
      DELETE FROM cupons WHERE id = ${cupomId} AND id_mercado = ${mercadoId}
      RETURNING id
    `;
    if (!apagado) return res.status(404).json({ erro: 'Cupom não encontrado.' });

    res.status(200).json({ mensagem: 'Cupom removido com sucesso.' });
  } catch (err) {
    console.error('ERRO deletarCupom:', err);
    res.status(500).json({ erro: 'Não foi possível remover o cupom.' });
  }
};

// POST /api/mercados/:id/cupons/validar — confere o cupom no carrinho (cliente)
// Devolve quanto o cupom abateria (levando em conta as categorias do escopo).
const validarCupomNoCarrinho = async (req, res) => {
  const mercadoId = Number(req.params.id);
  const { codigo, subtotal, itens } = req.body;

  if (!Number.isInteger(mercadoId) || mercadoId <= 0) {
    return res.status(400).json({ erro: 'Mercado inválido.' });
  }

  const codigoLimpo = typeof codigo === 'string' ? codigo.trim().toUpperCase().slice(0, 30) : '';
  if (!codigoLimpo) {
    return res.status(400).json({ erro: 'Informe o código do cupom.' });
  }

  // Itens do carrinho: a tela manda produto, quantidade e categoria. É a
  // partir deles que o desconto de um cupom com escopo é calculado.
  const itensValidos = Array.isArray(itens)
    ? itens
        .map((i) => ({
          id_categoria: Number(i?.id_categoria),
          preco: Number(i?.preco),
          quantidade: Number(i?.quantidade),
        }))
        .filter(
          (i) =>
            Number.isInteger(i.id_categoria) &&
            i.id_categoria > 0 &&
            Number.isFinite(i.preco) &&
            i.preco >= 0 &&
            Number.isFinite(i.quantidade) &&
            i.quantidade > 0
        )
    : null;

  const subtotalNum =
    itensValidos && itensValidos.length > 0
      ? Math.round(itensValidos.reduce((soma, i) => soma + i.preco * i.quantidade, 0) * 100) / 100
      : Number(subtotal) || 0;

  try {
    const sql = await conectar();

    const [cupom] = await sql`
      SELECT * FROM cupons
      WHERE id_mercado = ${mercadoId} AND codigo = ${codigoLimpo} AND ativo = TRUE
    `;
    if (!cupom) {
      return res.status(404).json({ erro: 'Cupom não encontrado ou desativado.' });
    }

    if (cupom.validade) {
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      const validade = new Date(cupom.validade);
      validade.setHours(23, 59, 59, 999);
      if (hoje > validade) {
        return res.status(400).json({ erro: 'Este cupom expirou.' });
      }
    }

    if (cupom.max_usos != null && Number(cupom.usos) >= Number(cupom.max_usos)) {
      return res.status(400).json({ erro: 'Este cupom já atingiu o limite de usos.' });
    }

    const minPedido = Number(cupom.min_pedido) || 0;
    if (subtotalNum < minPedido) {
      return res.status(400).json({
        erro: `Este cupom exige pedido mínimo de R$ ${minPedido.toFixed(2).replace('.', ',')}.`,
      });
    }

    // Escopo: sem categoria escolhida, o cupom vale para o pedido inteiro
    const categorias = (await categoriasPorCupom(sql, [cupom])).get(Number(cupom.id)) ?? [];

    let base = subtotalNum;
    if (categorias.length > 0) {
      const ids = new Set(categorias.map((c) => c.id));
      base = itensValidos
        ? Math.round(
            itensValidos
              .filter((i) => ids.has(i.id_categoria))
              .reduce((soma, i) => soma + i.preco * i.quantidade, 0) * 100
          ) / 100
        : 0;

      if (base <= 0) {
        const nomes = categorias.map((c) => c.nome).join(', ');
        return res.status(400).json({
          erro: `Este cupom vale apenas para produtos de: ${nomes}.`,
        });
      }
    }

    const desconto = calcularDesconto(cupom, base);

    res.status(200).json({
      valido: true,
      codigo: cupom.codigo,
      tipo: cupom.tipo,
      valor: Number(cupom.valor),
      desconto,
      minPedido,
      // Valor do pedido que entrou no cálculo (só as categorias do cupom)
      baseElegivel: base,
      categorias,
    });
  } catch (err) {
    console.error('ERRO validarCupomNoCarrinho:', err);
    res.status(500).json({ erro: 'Não foi possível validar o cupom.' });
  }
};

module.exports = { listarCupons, criarCupom, atualizarCupom, deletarCupom, validarCupomNoCarrinho };
