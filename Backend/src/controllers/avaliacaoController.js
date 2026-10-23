const { conectar } = require('../db/neon');

// ─────────────────────────────────────────────
// B6 — Moderação de avaliações
// O vendedor (dono/admin da loja) ou o administrador do site pode OCULTAR
// uma avaliação: ela some do site (e da média), mas continua no banco e
// pode ser exibida de novo. Nada é apagado.
// ─────────────────────────────────────────────

// Quem pode moderar: dono/admin do mercado ou administrador do site
async function podeModerar(sql, idUsuario, mercadoId) {
  if (idUsuario == null) return false;
  const [permissao] = await sql`
    SELECT papel FROM usuarios_mercados
    WHERE id_usuario = ${idUsuario} AND id_mercado = ${mercadoId}
  `;
  if (permissao && ['dono', 'admin'].includes(permissao.papel)) return true;
  const [admin] = await sql`
    SELECT is_admin FROM usuarios WHERE id_usuario = ${idUsuario}
  `;
  return !!admin?.is_admin;
}

// ─────────────────────────────────────────────
// GET /api/mercados/:id/avaliacoes
// Público (mostra "minha avaliação" se estiver logado).
// Ocultas ficam de fora do site; o vendedor/admin vê todas (com marcação).
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

    const moderando = await podeModerar(sql, idUsuario, mercadoId);

    const avaliacoes = await sql`
      SELECT a.id, a.id_usuario, a.nota, a.texto, a.data_cadastro, a.oculta, u.nome
      FROM avaliacoes a
      JOIN usuarios u ON u.id_usuario = a.id_usuario
      WHERE a.id_mercado = ${mercadoId}
      ORDER BY a.data_cadastro DESC
    `;

    // Site: só as visíveis; média e total também só contam as visíveis
    const visiveis = avaliacoes.filter(a => !a.oculta);
    const total = visiveis.length;
    const media = total > 0
      ? visiveis.reduce((soma, a) => soma + Number(a.nota), 0) / total
      : 0;

    // Quem modera vê as ocultas também, para poder exibir de novo
    const lista = moderando ? avaliacoes : visiveis;

    res.status(200).json({
      media: Math.round(media * 10) / 10,
      total,
      moderando,
      avaliacoes: lista.map(a => ({
        id: a.id,
        nota: Number(a.nota),
        texto: a.texto || '',
        data_cadastro: a.data_cadastro,
        cliente: a.nome,
        oculta: !!a.oculta,
        minha: idUsuario != null && Number(a.id_usuario) === Number(idUsuario),
      })),
    });
  } catch (err) {
    console.error('ERRO listarAvaliacoesMercado:', err);
    res.status(500).json({ erro: err.message });
  }
};

// ─────────────────────────────────────────────
// PUT /api/mercados/:id/avaliacoes/:avaliacaoId — oculta ou exibe (moderação)
// Body: { oculta: true | false }
// ─────────────────────────────────────────────
const alternarVisibilidadeAvaliacao = async (req, res) => {
  const idUsuario  = req.usuarioId;
  const mercadoId  = Number(req.params.id);
  const avaliacaoId = Number(req.params.avaliacaoId);
  const oculta = req.body?.oculta === true;

  if (!Number.isInteger(mercadoId) || mercadoId <= 0 ||
      !Number.isInteger(avaliacaoId) || avaliacaoId <= 0) {
    return res.status(400).json({ erro: 'Avaliação inválida.' });
  }

  try {
    const sql = await conectar();

    if (!(await podeModerar(sql, idUsuario, mercadoId))) {
      return res.status(403).json({ erro: 'Apenas o dono da loja ou um administrador pode moderar avaliações.' });
    }

    const [atualizada] = await sql`
      UPDATE avaliacoes SET oculta = ${oculta}
      WHERE id = ${avaliacaoId} AND id_mercado = ${mercadoId}
      RETURNING id, oculta
    `;
    if (!atualizada) {
      return res.status(404).json({ erro: 'Avaliação não encontrada.' });
    }

    res.status(200).json({
      mensagem: oculta ? 'Avaliação ocultada do site.' : 'Avaliação exibida no site novamente.',
      oculta: !!atualizada.oculta,
    });
  } catch (err) {
    console.error('ERRO alternarVisibilidadeAvaliacao:', err);
    res.status(500).json({ erro: err.message });
  }
};

// ─────────────────────────────────────────────
// GET /api/mercados/:id/avaliacoes-produtos — painel do vendedor:
// todas as avaliações de PRODUTOS da loja (inclusive ocultas), com o nome
// do produto, para moderar pelo mesmo painel das avaliações da loja.
// ─────────────────────────────────────────────
const listarAvaliacoesProdutosDoMercado = async (req, res) => {
  const idUsuario = req.usuarioId;
  const mercadoId = Number(req.params.id);

  if (!Number.isInteger(mercadoId) || mercadoId <= 0) {
    return res.status(400).json({ erro: 'Mercado inválido.' });
  }

  try {
    const sql = await conectar();

    if (!(await podeModerar(sql, idUsuario, mercadoId))) {
      return res.status(403).json({ erro: 'Apenas o dono da loja ou um administrador pode ver estas avaliações.' });
    }

    const avaliacoes = await sql`
      SELECT ap.id, ap.id_produto, p.id_categoria, ap.nota, ap.texto, ap.data_cadastro, ap.oculta,
             p.nome AS produto, u.nome
      FROM avaliacoes_produtos ap
      JOIN produtos p ON p.id_produto = ap.id_produto
      JOIN categorias c ON c.id_categoria = p.id_categoria
      JOIN usuarios u ON u.id_usuario = ap.id_usuario
      WHERE c.id_mercado = ${mercadoId}
      ORDER BY ap.data_cadastro DESC
      LIMIT 200
    `;

    res.status(200).json({
      avaliacoes: avaliacoes.map(a => ({
        id: a.id,
        produtoId: Number(a.id_produto),
        categoriaId: Number(a.id_categoria),
        produto: a.produto || '',
        nota: Number(a.nota),
        texto: a.texto || '',
        data_cadastro: a.data_cadastro,
        cliente: a.nome,
        oculta: !!a.oculta,
      })),
    });
  } catch (err) {
    console.error('ERRO listarAvaliacoesProdutosDoMercado:', err);
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
      WHERE id_mercado = ${mercadoId} AND oculta = FALSE
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

    const moderando = await podeModerar(sql, idUsuario, Number(mercadoId));

    const avaliacoes = await sql`
      SELECT a.id, a.id_usuario, a.nota, a.texto, a.data_cadastro, a.foto, a.verificada, a.oculta, u.nome
      FROM avaliacoes_produtos a
      JOIN usuarios u ON u.id_usuario = a.id_usuario
      WHERE a.id_produto = ${prodId}
      ORDER BY a.data_cadastro DESC
    `;

    // Ocultas ficam de fora do site (inclusive da média); quem modera vê todas
    const visiveis = avaliacoes.filter(a => !a.oculta);
    const total = visiveis.length;
    const media = total > 0
      ? visiveis.reduce((soma, a) => soma + Number(a.nota), 0) / total
      : 0;
    const lista = moderando ? avaliacoes : visiveis;

    res.status(200).json({
      media: Math.round(media * 10) / 10,
      total,
      avaliacoes: lista.map(a => ({
        id: a.id,
        nota: Number(a.nota),
        texto: a.texto || '',
        foto: a.foto || '',
        verificada: !!a.verificada,
        oculta: !!a.oculta,
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
      WHERE id_produto = ${prodId} AND oculta = FALSE
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

// ─────────────────────────────────────────────
// PUT /api/mercados/:mercadoId/categorias/:categoriaId/produtos/:produtoId/avaliacoes/:avaliacaoId
// Oculta ou exibe uma avaliação de produto (moderação — B6)
// ─────────────────────────────────────────────
const alternarVisibilidadeAvaliacaoProduto = async (req, res) => {
  const idUsuario = req.usuarioId;
  const { mercadoId, produtoId, avaliacaoId } = req.params;
  const prodId = Number(produtoId);
  const avId = Number(avaliacaoId);
  const oculta = req.body?.oculta === true;

  if (!Number.isInteger(prodId) || prodId <= 0 ||
      !Number.isInteger(avId) || avId <= 0) {
    return res.status(400).json({ erro: 'Avaliação inválida.' });
  }

  try {
    const sql = await conectar();

    if (!(await podeModerar(sql, idUsuario, Number(mercadoId)))) {
      return res.status(403).json({ erro: 'Apenas o dono da loja ou um administrador pode moderar avaliações.' });
    }

    const [atualizada] = await sql`
      UPDATE avaliacoes_produtos ap
      SET oculta = ${oculta}
      FROM produtos p, categorias c
      WHERE ap.id = ${avId}
        AND ap.id_produto = ${prodId}
        AND p.id_produto = ap.id_produto
        AND p.id_categoria = ${Number(req.params.categoriaId)}
        AND c.id_categoria = p.id_categoria
        AND c.id_mercado = ${Number(req.params.mercadoId)}
      RETURNING ap.id, ap.oculta
    `;
    if (!atualizada) {
      return res.status(404).json({ erro: 'Avaliação não encontrada.' });
    }

    res.status(200).json({
      mensagem: oculta ? 'Avaliação ocultada do site.' : 'Avaliação exibida no site novamente.',
      oculta: !!atualizada.oculta,
    });
  } catch (err) {
    console.error('ERRO alternarVisibilidadeAvaliacaoProduto:', err);
    res.status(500).json({ erro: err.message });
  }
};

module.exports = {
  listarAvaliacoesMercado,
  criarAvaliacao,
  listarAvaliacoesProduto,
  criarAvaliacaoProduto,
  alternarVisibilidadeAvaliacao,
  alternarVisibilidadeAvaliacaoProduto,
  listarAvaliacoesProdutosDoMercado,
};
