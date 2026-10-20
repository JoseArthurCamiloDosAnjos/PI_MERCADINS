const { conectar } = require('../db/neon');

// POST /api/mercados/:id/pedidos — cria um pedido a partir do carrinho do usuário
const criarPedido = async (req, res) => {
  const id_usuario = req.usuarioId;
  const mercadoId  = Number(req.params.id);
  const { itens, observacao } = req.body;

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

  // Observação é opcional: máx. 300 caracteres, sem caracteres de controle
  const observacaoLimpa = typeof observacao === 'string'
    ? observacao.replace(/[\u0000-\u001F\u007F]/g, ' ').trim().slice(0, 300)
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

    const [pedido] = await sql`
      INSERT INTO historico_compras (id_usuario, id_mercado, produtos, valor_total, status, observacao)
      VALUES (${id_usuario}, ${mercadoId}, ${resumo.join(', ')}, ${valorTotal.toFixed(2)}, 'pendente', ${observacaoLimpa})
      RETURNING id, id_mercado, produtos, valor_total, data_compra, status, observacao
    `;

    // Remove do carrinho apenas os produtos que foram comprados
    await sql`
      DELETE FROM carrinho
      WHERE id_usuario = ${id_usuario}
        AND id_mercado = ${mercadoId}
        AND id_produto = ANY(${idsProdutos})
    `;

    res.status(201).json({ mensagem: 'Pedido criado com sucesso.', pedido });
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
      SELECT h.id, h.produtos, h.valor_total, h.data_compra, h.status, h.observacao, u.nome AS cliente
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

    res.status(200).json({ mensagem: 'Status atualizado com sucesso.', pedido: atualizado });
  } catch (err) {
    console.error('ERRO atualizarStatusPedido:', err);
    res.status(500).json({ erro: 'Não foi possível atualizar o status.' });
  }
};

module.exports = { criarPedido, listarPedidosMercado, atualizarStatusPedido };
