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

module.exports = { listarAvaliacoesMercado, criarAvaliacao };
