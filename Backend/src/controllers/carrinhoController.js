const { conectar } = require('../db/neon');

// GET /api/carrinho/:mercadoId — busca carrinho do usuário logado
const buscarCarrinho = async (req, res) => {
  const id_usuario = req.usuarioId;

  const { mercadoId } = req.params;

  try {
    const sql = await conectar();

    const itens = await sql`
      SELECT c.id_produto, c.quantidade, p.nome, p.descricao, p.preco, p.imagem, p.id_categoria
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

// PUT /api/carrinho/:mercadoId — salva carrinho completo (substitui tudo)
const salvarCarrinho = async (req, res) => {
  const id_usuario = req.usuarioId;

  const { mercadoId } = req.params;
  const { itens } = req.body;

  if (!Array.isArray(itens)) {
    return res.status(400).json({ erro: 'itens deve ser um array' });
  }

  try {
    const sql = await conectar();

    await sql.transaction(async (tx) => {
      // Remove todos os itens atuais deste usuário/mercado
      await tx`
        DELETE FROM carrinho
        WHERE id_usuario = ${id_usuario}
          AND id_mercado = ${Number(mercadoId)}
      `;

      // Insere os novos itens (se houver)
      for (const item of itens) {
        if (item.quantidade > 0) {
          await tx`
            INSERT INTO carrinho (id_usuario, id_mercado, id_produto, quantidade)
            VALUES (${id_usuario}, ${Number(mercadoId)}, ${item.id_produto}, ${item.quantidade})
          `;
        }
      }
    });

    res.status(200).json({ mensagem: 'Carrinho salvo com sucesso' });
  } catch (err) {
    console.error('ERRO salvarCarrinho:', err);
    res.status(500).json({ erro: err.message });
  }
};

// DELETE /api/carrinho/:mercadoId — limpa carrinho do usuário
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
