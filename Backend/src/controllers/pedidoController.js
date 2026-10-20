const { conectar } = require('../db/neon');

// POST /api/mercados/:id/pedidos — cria um pedido a partir do carrinho do usuário
const criarPedido = async (req, res) => {
  const id_usuario = req.usuarioId;
  const mercadoId  = Number(req.params.id);
  const { itens }  = req.body;

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
      INSERT INTO historico_compras (id_usuario, id_mercado, produtos, valor_total, status)
      VALUES (${id_usuario}, ${mercadoId}, ${resumo.join(', ')}, ${valorTotal.toFixed(2)}, 'pendente')
      RETURNING id, id_mercado, produtos, valor_total, data_compra, status
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

module.exports = { criarPedido };
