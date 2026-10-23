const { conectar } = require('../db/neon');
const { enviarEmailPedidoConfirmado, enviarEmailStatusPedido } = require('../utils/mailer');

// ─────────────────────────────────────────────
// E-mails do pedido — busca os dados prontos e dispara sem travar a resposta
// (quem chama usa .catch(...); provedor fora do ar não derruba o pedido).
// ─────────────────────────────────────────────
async function montarDadosPedidoParaEmail(sql, idPedido) {
  const [dados] = await sql`
    SELECT h.id, h.produtos, h.valor_total, h.taxa_entrega, h.desconto, h.cupom_codigo,
           h.tipo_entrega, h.agendamento, h.status,
           u.email, u.nome AS cliente, m.nome AS mercado
    FROM historico_compras h
    JOIN usuarios u ON u.id_usuario = h.id_usuario
    JOIN mercados m ON m.id_mercado = h.id_mercado
    WHERE h.id = ${idPedido}
  `;
  if (!dados || !dados.email) return null;
  return {
    numero: dados.id,
    cliente: dados.cliente,
    mercado: dados.mercado,
    itens: dados.produtos,
    valorTotal: Number(dados.valor_total) || 0,
    desconto: Number(dados.desconto) || 0,
    cupom: dados.cupom_codigo || '',
    taxa: Number(dados.taxa_entrega) || 0,
    total: (Number(dados.valor_total) || 0) - (Number(dados.desconto) || 0) + (Number(dados.taxa_entrega) || 0),
    tipoEntrega: dados.tipo_entrega === 'retirada' ? 'retirada' : 'entrega',
    agendamento: dados.agendamento || '',
    email: dados.email,
    status: dados.status || 'pendente',
  };
}

// POST /api/mercados/:id/pedidos — cria um pedido a partir do carrinho do usuário
const criarPedido = async (req, res) => {
  const id_usuario = req.usuarioId;
  const mercadoId  = Number(req.params.id);
  const { itens, observacao, tipo_entrega, cupom, agendamento } = req.body;

  if (!Array.isArray(itens) || itens.length === 0) {
    return res.status(400).json({ erro: 'Informe os itens do pedido.' });
  }

  // Validação básica de cada item (id inteiro > 0 e quantidade inteira > 0)
  for (const item of itens) {
    const idProduto  = Number(item && item.id_produto);
    const quantidade = Number(item && item.quantidade);
    if (!Number.isInteger(idProduto) || idProduto <= 0 ||
        !Number.isInteger(quantidade) || quantidade <= 0) {
      return res.status(400).json({ erro: 'Item inválido no pedido.' });
    }
  }

  if (!Number.isInteger(mercadoId) || mercadoId <= 0) {
    return res.status(400).json({ erro: 'Mercado inválido.' });
  }

  // Entrega pelo cliente ou retirada no balcão (padrão: entrega)
  const tipoEntrega = tipo_entrega === 'retirada' ? 'retirada' : 'entrega';

  // Observação é opcional: máx. 300 caracteres, sem caracteres de controle
  const observacaoLimpa = typeof observacao === 'string'
    ? observacao.replace(/[\u0000-\u001F\u007F]/g, ' ').trim().slice(0, 300)
    : '';

  // Agendamento é opcional: quando o cliente quer receber/retirar
  // (ex.: "Hoje à tarde", "Amanhã de manhã") — máx. 60 caracteres
  const agendamentoLimpo = typeof agendamento === 'string'
    ? agendamento.replace(/[\u0000-\u001F\u007F]/g, ' ').trim().slice(0, 60)
    : '';

  try {
    const sql = await conectar();

    const idsProdutos = [...new Set(itens.map(i => Number(i.id_produto)))];

    // Só aceita produtos que pertencem a este mercado
    // (produtos não têm id_mercado direto: a ligação é pela categoria)
    const produtos = await sql`
      SELECT p.id_produto, p.nome, p.preco, p.estoque
      FROM produtos p
      JOIN categorias c ON c.id_categoria = p.id_categoria
      WHERE c.id_mercado = ${mercadoId}
        AND p.id_produto = ANY(${idsProdutos})
    `;

    if (produtos.length !== idsProdutos.length) {
      return res.status(400).json({ erro: 'Alguns produtos não pertencem a este mercado.' });
    }

    // Regras de entrega do mercado (taxa, mínimo e quais formas aceita)
    const [mercado] = await sql`
      SELECT nome, taxa_entrega, pedido_minimo, oferece_entrega, oferece_retirada
      FROM mercados
      WHERE id_mercado = ${mercadoId}
    `;
    if (!mercado) {
      return res.status(404).json({ erro: 'Mercado não encontrado.' });
    }

    if (tipoEntrega === 'entrega' && mercado.oferece_entrega === false) {
      return res.status(400).json({ erro: 'Este mercado não faz entrega — escolha retirar no balcão.' });
    }
    if (tipoEntrega === 'retirada' && mercado.oferece_retirada === false) {
      return res.status(400).json({ erro: 'Este mercado não permite retirada no balcão.' });
    }

    const mapaProdutos = new Map(produtos.map(p => [Number(p.id_produto), p]));

    // O valor total é calculado SEMPRE pelo preço do banco, nunca pelo cliente
    let valorTotal = 0;
    const resumo = [];
    for (const item of itens) {
      const produto    = mapaProdutos.get(Number(item.id_produto));
      const quantidade = Number(item.quantidade);

      // Estoque: a quantidade pedida nunca pode passar do disponível
      const disponivel = Number(produto.estoque) || 0;
      if (quantidade > disponivel) {
        const motivo = disponivel <= 0
          ? `O produto "${produto.nome}" está sem estoque.`
          : `Estoque insuficiente para "${produto.nome}": disponível ${disponivel}, solicitado ${quantidade}.`;
        return res.status(400).json({ erro: motivo });
      }

      valorTotal += Number(produto.preco ?? 0) * quantidade;
      resumo.push(`${quantidade}x ${produto.nome}`);
    }

    // Pedido mínimo só vale para entrega (na retirada o cliente pega no balcão)
    const pedidoMinimo = Number(mercado.pedido_minimo) || 0;
    if (tipoEntrega === 'entrega' && pedidoMinimo > 0 && valorTotal < pedidoMinimo) {
      return res.status(400).json({
        erro: `Pedido mínimo de R$ ${pedidoMinimo.toFixed(2).replace('.', ',')} para entrega.`,
      });
    }

    // Cupom de desconto (opcional) — conferido no banco, nunca no navegador
    let desconto = 0;
    let cupomRegistro = null;
    if (typeof cupom === 'string' && cupom.trim()) {
      const codigo = cupom.trim().toUpperCase().slice(0, 30);
      const [registro] = await sql`
        SELECT * FROM cupons
        WHERE id_mercado = ${mercadoId}
          AND upper(codigo) = ${codigo}
          AND ativo = TRUE
      `;
      if (!registro) {
        return res.status(400).json({ erro: 'Cupom inválido ou desativado.' });
      }
      if (registro.validade) {
        // validade chega como meia-noite (fuso do banco): compara até o fim do dia
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        const validade = new Date(registro.validade);
        validade.setHours(23, 59, 59, 999);
        if (hoje > validade) {
          return res.status(400).json({ erro: 'Este cupom expirou.' });
        }
      }
      if (registro.max_usos != null && Number(registro.usos) >= Number(registro.max_usos)) {
        return res.status(400).json({ erro: 'Este cupom já atingiu o limite de usos.' });
      }
      const minPedido = Number(registro.min_pedido) || 0;
      if (valorTotal < minPedido) {
        return res.status(400).json({
          erro: `Este cupom exige pedido mínimo de R$ ${minPedido.toFixed(2).replace('.', ',')}.`,
        });
      }
      desconto = registro.tipo === 'percentual'
        ? valorTotal * (Number(registro.valor) / 100)
        : Number(registro.valor);
      desconto = Math.min(Math.round(desconto * 100) / 100, valorTotal);
      cupomRegistro = registro;
    }

    // Taxa: cobrada só na entrega; no balcão é grátis
    const taxaEntrega = tipoEntrega === 'entrega' ? Number(mercado.taxa_entrega) || 0 : 0;

    // Ids dos produtos comprados — usados pelo selo "compra verificada" da
    // avaliação de produto (quem já comprou pode receber o selo)
    const produtoIds = idsProdutos.join(',');

    const [pedido] = await sql`
      INSERT INTO historico_compras (
        id_usuario, id_mercado, produtos, valor_total, status, observacao,
        tipo_entrega, taxa_entrega, agendamento, cupom_codigo, desconto, produto_ids
      )
      VALUES (
        ${id_usuario}, ${mercadoId}, ${resumo.join(', ')}, ${valorTotal.toFixed(2)}, 'pendente', ${observacaoLimpa},
        ${tipoEntrega}, ${taxaEntrega.toFixed(2)}, ${agendamentoLimpo}, ${cupomRegistro ? cupomRegistro.codigo : ''}, ${desconto.toFixed(2)}, ${produtoIds}
      )
      RETURNING id, id_mercado, produtos, valor_total, data_compra, status, observacao,
                tipo_entrega, taxa_entrega, agendamento, cupom_codigo, desconto
    `;

    // Cupom usado: soma 1 no contador de usos
    if (cupomRegistro) {
      await sql`UPDATE cupons SET usos = usos + 1 WHERE id = ${cupomRegistro.id}`;
    }

    // Remove do carrinho apenas os produtos que foram comprados
    await sql`
      DELETE FROM carrinho
      WHERE id_usuario = ${id_usuario}
        AND id_mercado = ${mercadoId}
        AND id_produto = ANY(${idsProdutos})
    `;

    // E-mail de confirmação para o cliente (dispara sem segurar a resposta)
    montarDadosPedidoParaEmail(sql, pedido.id)
      .then((dados) => dados && enviarEmailPedidoConfirmado(dados.email, dados))
      .catch((err) => console.error('Falha no e-mail de confirmação do pedido:', err.message));

    res.status(201).json({
      mensagem: 'Pedido criado com sucesso.',
      pedido: {
        ...pedido,
        total: valorTotal - desconto + taxaEntrega,
      },
    });
  } catch (err) {
    console.error('ERRO criarPedido:', err);
    res.status(500).json({ erro: 'Não foi possível registrar o pedido. Tente novamente.' });
  }
};

// GET /api/mercados/:id/pedidos — lista os pedidos recebidos pelo mercado (vendedor)
const listarPedidosMercado = async (req, res) => {
  const id_usuario = req.usuarioId;
  const mercadoId  = Number(req.params.id);

  if (!Number.isInteger(mercadoId) || mercadoId <= 0) {
    return res.status(400).json({ erro: 'Mercado inválido.' });
  }

  try {
    const sql = await conectar();

    // Só quem gerencia o mercado pode ver os pedidos dele
    const [permissao] = await sql`
      SELECT 1 FROM usuarios_mercados
      WHERE id_usuario = ${id_usuario} AND id_mercado = ${mercadoId}
    `;
    if (!permissao) {
      return res.status(403).json({ erro: 'Você não tem acesso aos pedidos deste mercado.' });
    }

    const pedidos = await sql`
      SELECT h.id, h.produtos, h.valor_total, h.data_compra, h.status, h.observacao,
             h.tipo_entrega, h.taxa_entrega, h.agendamento, h.cupom_codigo, h.desconto,
             u.nome AS cliente
      FROM historico_compras h
      JOIN usuarios u ON u.id_usuario = h.id_usuario
      WHERE h.id_mercado = ${mercadoId}
      ORDER BY h.data_compra DESC
      LIMIT 50
    `;

    res.status(200).json({
      pedidos: pedidos.map(p => ({
        id: p.id,
        cliente: p.cliente,
        itens: p.produtos,
        valorTotal: Number(p.valor_total),
        dataCompra: p.data_compra,
        status: p.status || 'pendente',
        observacao: p.observacao || '',
        tipoEntrega: p.tipo_entrega === 'retirada' ? 'retirada' : 'entrega',
        taxaEntrega: Number(p.taxa_entrega) || 0,
        agendamento: p.agendamento || '',
        cupom: p.cupom_codigo || '',
        desconto: Number(p.desconto) || 0,
      })),
    });
  } catch (err) {
    console.error('ERRO listarPedidosMercado:', err);
    res.status(500).json({ erro: 'Não foi possível carregar os pedidos.' });
  }
};

// ─────────────────────────────────────────────
// PUT /api/pedidos/:id/status — vendedor atualiza o status do pedido
// Ordem: pendente → preparo → caminho → entregue (só avança, nunca volta)
// ─────────────────────────────────────────────
const ORDEM_STATUS = ['pendente', 'preparo', 'caminho', 'entregue'];

const atualizarStatusPedido = async (req, res) => {
  const id_usuario = req.usuarioId;
  const pedidoId   = Number(req.params.id);
  const { status } = req.body;

  if (!Number.isInteger(pedidoId) || pedidoId <= 0) {
    return res.status(400).json({ erro: 'Pedido inválido.' });
  }
  if (!ORDEM_STATUS.includes(status)) {
    return res.status(400).json({ erro: 'Status inválido. Use: pendente, preparo, caminho ou entregue.' });
  }

  try {
    const sql = await conectar();

    const [pedido] = await sql`
      SELECT id, id_mercado, status FROM historico_compras WHERE id = ${pedidoId}
    `;
    if (!pedido) {
      return res.status(404).json({ erro: 'Pedido não encontrado.' });
    }

    // Só quem gerencia o mercado do pedido pode alterá-lo
    const [permissao] = await sql`
      SELECT 1 FROM usuarios_mercados
      WHERE id_usuario = ${id_usuario} AND id_mercado = ${pedido.id_mercado}
    `;
    if (!permissao) {
      return res.status(403).json({ erro: 'Você não tem acesso a este pedido.' });
    }

    const atual = ORDEM_STATUS.includes(pedido.status) ? pedido.status : 'pendente';
    if (ORDEM_STATUS.indexOf(status) < ORDEM_STATUS.indexOf(atual)) {
      return res.status(400).json({ erro: 'O status de um pedido só pode avançar, não voltar.' });
    }

    const [atualizado] = await sql`
      UPDATE historico_compras SET status = ${status}
      WHERE id = ${pedidoId}
      RETURNING id, status
    `;

    // Avisa o cliente por e-mail (fire-and-forget: falha de e-mail não afeta o pedido)
    montarDadosPedidoParaEmail(sql, pedidoId)
      .then((dados) => dados && enviarEmailStatusPedido(dados.email, dados, status))
      .catch((err) => console.error('Falha no e-mail de status do pedido:', err.message));

    res.status(200).json({ mensagem: 'Status atualizado com sucesso.', pedido: atualizado });
  } catch (err) {
    console.error('ERRO atualizarStatusPedido:', err);
    res.status(500).json({ erro: 'Não foi possível atualizar o status.' });
  }
};

// ─────────────────────────────────────────────
// GET /api/mercados/:id/financeiro?ano=2026&mes=10
// Painel financeiro do mês escolhido: faturamento, custos, lucro e demanda.
// Feito para o pequeno comércio que "não sabe quanto ganha e quanto gasta":
//   - Faturamento = soma dos pedidos do mês
//   - Custo da mercadoria = quantidade vendida x custo cadastrado no produto
//   - Custo fixo = valor mensal informado pelo vendedor (aluguel, luz, salários)
//   - Lucro = faturamento − custo da mercadoria − custo fixo (pode dar negativo)
// ─────────────────────────────────────────────
const round2 = (v) => Math.round(v * 100) / 100;

// Resumo gravado no pedido ("2x Arroz, 1x Feijão") → [{ qtd, nome }]
function parseItensPedido(txt) {
  const out = [];
  for (const parte of String(txt || '').split(', ')) {
    const limpo = parte.trim();
    if (!limpo) continue;
    const m = /^(\d+)\s*x\s+(.+)$/.exec(limpo);
    if (m) out.push({ qtd: Number(m[1]), nome: m[2] });
  }
  return out;
}

const financeiroMercado = async (req, res) => {
  const id_usuario = req.usuarioId;
  const mercadoId  = Number(req.params.id);

  if (!Number.isInteger(mercadoId) || mercadoId <= 0) {
    return res.status(400).json({ erro: 'Mercado inválido.' });
  }

  const agora = new Date();
  const ano = Number(req.query.ano) || agora.getFullYear();
  const mes = Number(req.query.mes) || agora.getMonth() + 1;
  if (!Number.isInteger(ano) || !Number.isInteger(mes) ||
      ano < 2020 || ano > 2100 || mes < 1 || mes > 12) {
    return res.status(400).json({ erro: 'Período inválido.' });
  }

  try {
    const sql = await conectar();

    // Só quem gerencia o mercado vê o financeiro dele
    const [permissao] = await sql`
      SELECT 1 FROM usuarios_mercados
      WHERE id_usuario = ${id_usuario} AND id_mercado = ${mercadoId}
    `;
    if (!permissao) {
      return res.status(403).json({ erro: 'Você não tem acesso ao financeiro deste mercado.' });
    }

    // Busca com folga de 1 dia em cada lado (cobre diferença de fuso na
    // comparação) e filtra o mês exato no JavaScript, com o relógio local.
    // data_local: a coluna é "timestamp" sem fuso; a conversão devolve o
    // horário de Taquaritinga (America/Sao_Paulo) para dia e mês certos
    const folgaInicio = new Date(ano, mes - 1, 0);
    const folgaFim    = new Date(ano, mes, 2);

    const pedidos = await sql`
      SELECT h.produtos, h.valor_total, h.status,
             (h.data_compra AT TIME ZONE current_setting('TimeZone')) AT TIME ZONE 'America/Sao_Paulo' AS data_local
      FROM historico_compras h
      WHERE h.id_mercado = ${mercadoId}
        AND h.data_compra >= ${folgaInicio}
        AND h.data_compra <  ${folgaFim}
      ORDER BY h.data_compra ASC
      LIMIT 5000
    `;

    const produtosMercado = await sql`
      SELECT p.nome, p.preco, p.custo
      FROM produtos p
      JOIN categorias c ON c.id_categoria = p.id_categoria
      WHERE c.id_mercado = ${mercadoId}
    `;

    const [mercado] = await sql`
      SELECT custos_fixos FROM mercados WHERE id_mercado = ${mercadoId}
    `;

    const mapaProdutos = new Map(produtosMercado.map(p => [p.nome, p]));

    let faturamento = 0, custoMercadoria = 0, totalPedidos = 0, itensSemCusto = 0;
    const porStatus = { pendente: 0, preparo: 0, caminho: 0, entregue: 0 };
    const porDia = new Map();
    const porProduto = new Map();

    for (const p of pedidos) {
      const d = new Date(p.data_local);
      if (d.getFullYear() !== ano || d.getMonth() + 1 !== mes) continue;

      const valor = Number(p.valor_total) || 0;
      faturamento += valor;
      totalPedidos += 1;

      const st = p.status || 'pendente';
      porStatus[st] = (porStatus[st] || 0) + 1;

      const dia = d.getDate();
      const reg = porDia.get(dia) || { pedidos: 0, receita: 0 };
      reg.pedidos += 1;
      reg.receita += valor;
      porDia.set(dia, reg);

      // Itens do pedido casados com o cadastro atual (preço e custo)
      for (const item of parseItensPedido(p.produtos)) {
        const ref = mapaProdutos.get(item.nome);
        const custo = ref ? Number(ref.custo) || 0 : 0;
        // Sem custo cadastrado (ou produto renomeado/removido): avisa o vendedor
        if (!ref || custo <= 0) itensSemCusto += item.qtd;
        custoMercadoria += custo * item.qtd;

        const pp = porProduto.get(item.nome) || { qtd: 0, receita: 0 };
        pp.qtd += item.qtd;
        pp.receita += (ref ? Number(ref.preco) || 0 : 0) * item.qtd;
        porProduto.set(item.nome, pp);
      }
    }

    const custoFixo = Number(mercado?.custos_fixos) || 0;
    const lucro = faturamento - custoMercadoria - custoFixo;
    const diasNoMes = new Date(ano, mes, 0).getDate();

    res.status(200).json({
      ano,
      mes,
      pedidos: totalPedidos,
      faturamento: round2(faturamento),
      ticketMedio: totalPedidos > 0 ? round2(faturamento / totalPedidos) : 0,
      custoMercadoria: round2(custoMercadoria),
      custoFixo: round2(custoFixo),
      lucro: round2(lucro),
      itensSemCusto,
      porStatus,
      serieDiaria: Array.from({ length: diasNoMes }, (_, i) => {
        const reg = porDia.get(i + 1) || { pedidos: 0, receita: 0 };
        return { dia: i + 1, pedidos: reg.pedidos, receita: round2(reg.receita) };
      }),
      topProdutos: [...porProduto.entries()]
        .map(([nome, v]) => ({ nome, qtd: v.qtd, receita: round2(v.receita) }))
        .sort((a, b) => b.qtd - a.qtd || b.receita - a.receita)
        .slice(0, 8),
    });
  } catch (err) {
    console.error('ERRO financeiroMercado:', err);
    res.status(500).json({ erro: 'Não foi possível carregar o financeiro do mercado.' });
  }
};

module.exports = { criarPedido, listarPedidosMercado, atualizarStatusPedido, financeiroMercado };
