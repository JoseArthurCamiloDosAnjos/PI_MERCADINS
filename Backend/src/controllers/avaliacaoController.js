const { conectar } = require('../db/neon');

// ─────────────────────────────────────────────
// GET /api/mercados/:id/avaliacoes
// Público (mostra "minha avaliação" se estiver logado)
// ─────────────────────────────────────────────
const listarAvaliacoesMercado = async (req, res) => {
  const mercadoId = Number(req.params.id);
  const idUsuario = req.usuarioId ?? null;

  if (!Number.isInteger(mercadoId) || mercadoId <= 0) {
    return res.status(400).json({ erro: 'Mercado inválido.' });
  }

  try {
    const sql = await conectar();

    const [mercado] = await sql`
      SELECT id_mercado FROM mercados WHERE id_mercado = ${mercadoId}
    `;
    if (!mercado) {
      return res.status(404).json({ erro: 'Mercado não encontrado.' });
    }

    const avaliacoes = await sql`
      SELECT a.id, a.id_usuario, a.nota, a.texto, a.data_cadastro, u.nome
      FROM avaliacoes a
      JOIN usuarios u ON u.id_usuario = a.id_usuario
      WHERE a.id_mercado = ${mercadoId}
      ORDER BY a.data_cadastro DESC
    `;

    const total = avaliacoes.length;
    const media = total > 0
      ? avaliacoes.reduce((soma, a) => soma + Number(a.nota), 0) / total
      : 0;

    res.status(200).json({
      media: Math.round(media * 10) / 10,
      total,
      avaliacoes: avaliacoes.map(a => ({
        id: a.id,
        nota: Number(a.nota),
        texto: a.texto || '',
        data_cadastro: a.data_cadastro,
        cliente: a.nome,
        minha: idUsuario != null && Number(a.id_usuario) === Number(idUsuario),
      })),
    });
  } catch (err) {
    console.error('ERRO listarAvaliacoesMercado:', err);
    res.status(500).json({ erro: err.message });
  }
};

// ─────────────────────────────────────────────
// POST /api/mercados/:id/avaliacoes
// Logado; cada usuário avalia uma vez (pode atualizar depois)
// ─────────────────────────────────────────────
const criarAvaliacao = async (req, res) => {
  const idUsuario = req.usuarioId;
  const mercadoId = Number(req.params.id);
  const { nota, texto } = req.body;

  const notaNum = Number(nota);

  if (!Number.isInteger(mercadoId) || mercadoId <= 0) {
    return res.status(400).json({ erro: 'Mercado inválido.' });
  }
  if (!Number.isInteger(notaNum) || notaNum < 1 || notaNum > 5) {
    return res.status(400).json({ erro: 'Escolha uma nota de 1 a 5 estrelas.' });
  }

  try {
    const sql = await conectar();

    const [mercado] = await sql`
      SELECT id_mercado FROM mercados WHERE id_mercado = ${mercadoId}
    `;
    if (!mercado) {
      return res.status(404).json({ erro: 'Mercado não encontrado.' });
    }

    const textoLimpo = typeof texto === 'string' ? texto.trim().slice(0, 500) : '';

    // Sobe ou atualiza a avaliação do usuário neste mercado
    await sql`
      INSERT INTO avaliacoes (id_usuario, id_mercado, nota, texto)
      VALUES (${idUsuario}, ${mercadoId}, ${notaNum}, ${textoLimpo})
      ON CONFLICT (id_usuario, id_mercado)
      DO UPDATE SET nota = EXCLUDED.nota, texto = EXCLUDED.texto, data_cadastro = NOW()
    `;

    const [dados] = await sql`
      SELECT COALESCE(AVG(nota), 0)::numeric(2,1) AS media, COUNT(*)::int AS total
      FROM avaliacoes
      WHERE id_mercado = ${mercadoId}
    `;

    res.status(201).json({
      mensagem: 'Avaliação registrada com sucesso.',
      media: Number(dados.media),
      total: dados.total,
    });
  } catch (err) {
    console.error('ERRO criarAvaliacao:', err);
    res.status(500).json({ erro: err.message });
  }
};

// ─────────────────────────────────────────────
// GET /api/mercados/:mercadoId/categorias/:categoriaId/produtos/:produtoId/avaliacoes
// Público (mostra "minha avaliação" se estiver logado)
// ─────────────────────────────────────────────
const listarAvaliacoesProduto = async (req, res) => {
  const { mercadoId, categoriaId, produtoId } = req.params;
  const idUsuario = req.usuarioId ?? null;
  const prodId = Number(produtoId);

  if (!Number.isInteger(prodId) || prodId <= 0) {
    return res.status(400).json({ erro: 'Produto inválido.' });
  }

  try {
    const sql = await conectar();

    const [produto] = await sql`
      SELECT p.id_produto
      FROM produtos p
      JOIN categorias c ON c.id_categoria = p.id_categoria
      WHERE p.id_produto = ${prodId}
        AND p.id_categoria = ${Number(categoriaId)}
        AND c.id_mercado  = ${Number(mercadoId)}
    `;
    if (!produto) {
      return res.status(404).json({ erro: 'Produto não encontrado.' });
    }

    const avaliacoes = await sql`
      SELECT a.id, a.id_usuario, a.nota, a.texto, a.data_cadastro, a.foto, a.verificada, u.nome
      FROM avaliacoes_produtos a
      JOIN usuarios u ON u.id_usuario = a.id_usuario
      WHERE a.id_produto = ${prodId}
      ORDER BY a.data_cadastro DESC
    `;

    const total = avaliacoes.length;
    const media = total > 0
      ? avaliacoes.reduce((soma, a) => soma + Number(a.nota), 0) / total
      : 0;

    res.status(200).json({
      media: Math.round(media * 10) / 10,
      total,
      avaliacoes: avaliacoes.map(a => ({
        id: a.id,
        nota: Number(a.nota),
        texto: a.texto || '',
        foto: a.foto || '',
        verificada: !!a.verificada,
        data_cadastro: a.data_cadastro,
        cliente: a.nome,
        minha: idUsuario != null && Number(a.id_usuario) === Number(idUsuario),
      })),
    });
  } catch (err) {
    console.error('ERRO listarAvaliacoesProduto:', err);
    res.status(500).json({ erro: err.message });
  }
};

// ─────────────────────────────────────────────
// POST /api/mercados/:mercadoId/categorias/:categoriaId/produtos/:produtoId/avaliacoes
// Logado; cada usuário avalia uma vez (pode atualizar depois)
// ─────────────────────────────────────────────
const criarAvaliacaoProduto = async (req, res) => {
  const idUsuario = req.usuarioId;
  const { mercadoId, categoriaId, produtoId } = req.params;
  const prodId = Number(produtoId);
  const { nota, texto, foto } = req.body;

  const notaNum = Number(nota);

  if (!Number.isInteger(prodId) || prodId <= 0) {
    return res.status(400).json({ erro: 'Produto inválido.' });
  }
  if (!Number.isInteger(notaNum) || notaNum < 1 || notaNum > 5) {
    return res.status(400).json({ erro: 'Escolha uma nota de 1 a 5 estrelas.' });
  }

  // Foto é opcional: quando vem, precisa ser um link de imagem http(s)
  let fotoLimpa = '';
  if (typeof foto === 'string' && foto.trim()) {
    fotoLimpa = foto.trim().slice(0, 500);
    if (!/^https?:\/\/\S+$/i.test(fotoLimpa)) {
      return res.status(400).json({ erro: 'Foto inválida — use um link de imagem começando com http:// ou https://.' });
    }
  }

  try {
    const sql = await conectar();

    const [produto] = await sql`
      SELECT p.id_produto
      FROM produtos p
      JOIN categorias c ON c.id_categoria = p.id_categoria
      WHERE p.id_produto = ${prodId}
        AND p.id_categoria = ${Number(categoriaId)}
        AND c.id_mercado  = ${Number(mercadoId)}
    `;
    if (!produto) {
      return res.status(404).json({ erro: 'Produto não encontrado.' });
    }

    const textoLimpo = typeof texto === 'string' ? texto.trim().slice(0, 500) : '';

    // Selo "compra verificada": só recebe quem já comprou este produto.
    // O pedido guarda os ids comprados em produto_ids (ex.: "12,31,44").
    const [compra] = await sql`
      SELECT 1 FROM historico_compras
      WHERE id_usuario = ${idUsuario}
        AND produto_ids != ''
        AND string_to_array(produto_ids, ',') @> ARRAY[${String(prodId)}]
      LIMIT 1
    `;
    const verificada = !!compra;

    // Sobe ou atualiza a avaliação do usuário neste produto
    await sql`
      INSERT INTO avaliacoes_produtos (id_usuario, id_produto, nota, texto, foto, verificada)
      VALUES (${idUsuario}, ${prodId}, ${notaNum}, ${textoLimpo}, ${fotoLimpa}, ${verificada})
      ON CONFLICT (id_usuario, id_produto)
      DO UPDATE SET nota = EXCLUDED.nota, texto = EXCLUDED.texto, foto = EXCLUDED.foto,
                    verificada = EXCLUDED.verificada, data_cadastro = NOW()
    `;

    const [dados] = await sql`
      SELECT COALESCE(AVG(nota), 0)::numeric(2,1) AS media, COUNT(*)::int AS total
      FROM avaliacoes_produtos
      WHERE id_produto = ${prodId}
    `;

    res.status(201).json({
      mensagem: verificada
        ? 'Avaliação registrada com selo de compra verificada.'
        : 'Avaliação registrada com sucesso.',
      media: Number(dados.media),
      total: dados.total,
      verificada,
    });
  } catch (err) {
    console.error('ERRO criarAvaliacaoProduto:', err);
    res.status(500).json({ erro: err.message });
  }
};

module.exports = { listarAvaliacoesMercado, criarAvaliacao, listarAvaliacoesProduto, criarAvaliacaoProduto };
