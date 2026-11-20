const { conectar } = require('../db/neon');
const { limiteUnidadesProduto } = require('../utils/limites');

const buscarCarrinho = async (req, res) => {
  const id_usuario = req.usuarioId;

  const { mercadoId } = req.params;

  try {
    const sql = await conectar();

    const itens = await sql`
      SELECT c.id_produto, c.quantidade, p.nome, p.descricao, p.preco, p.imagem, p.estoque, p.id_categoria
      FROM carrinho c
      JOIN produtos p ON p.id_produto = c.id_produto
      WHERE c.id_usuario = ${id_usuario}
        AND c.id_mercado = ${Number(mercadoId)}
    `;

    res.status(200).json({ itens });
  } catch (err) {
    console.error('ERRO buscarCarrinho:', err);
    res.status(500).json({ erro: err.message });
  }
};

const salvarCarrinho = async (req, res) => {
  const id_usuario = req.usuarioId;

  const { mercadoId } = req.params;
  const { itens } = req.body;

  if (!Array.isArray(itens)) {
    return res.status(400).json({ erro: 'itens deve ser um array' });
  }

  try {
    const sql = await conectar();

    // Só aceita itens bem formados (id e quantidade inteiros positivos).
    const entrada = itens
      .map(item => ({
        id_produto: Number(item?.id_produto),
        quantidade: Number(item?.quantidade),
      }))
      .filter(item =>
        Number.isInteger(item.id_produto) && item.id_produto > 0 &&
        Number.isInteger(item.quantidade) && item.quantidade > 0
      );

    const ids = [...new Set(entrada.map(item => item.id_produto))];
    const produtos = ids.length > 0
      ? await sql`
          SELECT p.id_produto, p.estoque
          FROM produtos p
          JOIN categorias c ON c.id_categoria = p.id_categoria
          WHERE c.id_mercado = ${Number(mercadoId)}
            AND p.id_produto = ANY(${ids})
        `
      : [];

    // A quantidade nunca passa do limite do produto (estoque e teto por
    // produto): itens de outro mercado ou acima do limite são descartados ou
    // ajustados, para que a regra não possa ser burlada por requisição direta.
    const limitePorId = new Map(
      produtos.map(p => [Number(p.id_produto), limiteUnidadesProduto(p.estoque)])
    );

    const ajustados = [];
    const vistos = new Set();
    let ajustou = false;

    for (const item of entrada) {
      if (vistos.has(item.id_produto)) continue;
      vistos.add(item.id_produto);

      const limite = limitePorId.get(item.id_produto);
      if (limite === undefined) continue;

      const quantidade = Math.min(item.quantidade, limite);
      if (quantidade !== item.quantidade) ajustou = true;
      if (quantidade > 0) ajustados.push({ id_produto: item.id_produto, quantidade });
    }

    await sql.transaction(async (tx) => {
      await tx`
        DELETE FROM carrinho
        WHERE id_usuario = ${id_usuario}
          AND id_mercado = ${Number(mercadoId)}
      `;

      for (const item of ajustados) {
        await tx`
          INSERT INTO carrinho (id_usuario, id_mercado, id_produto, quantidade)
          VALUES (${id_usuario}, ${Number(mercadoId)}, ${item.id_produto}, ${item.quantidade})
        `;
      }
    });

    res.status(200).json({
      mensagem: ajustou
        ? 'Carrinho salvo com quantidades ajustadas ao limite disponível.'
        : 'Carrinho salvo com sucesso',
      ajustado: ajustou,
      itens: ajustados,
    });
  } catch (err) {
    console.error('ERRO salvarCarrinho:', err);
    res.status(500).json({ erro: err.message });
  }
};

const limparCarrinho = async (req, res) => {
  const id_usuario = req.usuarioId;

  const { mercadoId } = req.params;

  try {
    const sql = await conectar();

    await sql`
      DELETE FROM carrinho
      WHERE id_usuario = ${id_usuario}
        AND id_mercado = ${Number(mercadoId)}
    `;

    res.status(200).json({ mensagem: 'Carrinho limpo com sucesso' });
  } catch (err) {
    console.error('ERRO limparCarrinho:', err);
    res.status(500).json({ erro: err.message });
  }
};

module.exports = { buscarCarrinho, salvarCarrinho, limparCarrinho };
