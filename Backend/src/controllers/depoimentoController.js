const { conectar } = require('../db/neon');

// Depoimentos da plataforma

const listarDepoimentos = async (req, res) => {
  const idUsuario = req.usuarioId ?? null;

  try {
    const sql = await conectar();

    const depoimentos = await sql`
      SELECT d.id, d.id_usuario, d.nota, d.texto, d.data_cadastro, u.nome
      FROM depoimentos d
      JOIN usuarios u ON u.id_usuario = d.id_usuario
      WHERE d.oculta = FALSE
      ORDER BY d.data_cadastro DESC
      LIMIT 60
    `;

    const total = depoimentos.length;
    const media = total > 0
      ? depoimentos.reduce((soma, d) => soma + Number(d.nota), 0) / total
      : 0;

    res.status(200).json({
      media: Math.round(media * 10) / 10,
      total,
      depoimentos: depoimentos.map((d) => ({
        id: d.id,
        nota: Number(d.nota),
        texto: d.texto || '',
        data_cadastro: d.data_cadastro,
        cliente: d.nome,
        minha: idUsuario != null && Number(d.id_usuario) === Number(idUsuario),
      })),
    });
  } catch (err) {
    console.error('ERRO listarDepoimentos:', err);
    res.status(500).json({ erro: 'Não foi possível carregar os depoimentos.' });
  }
};

const criarDepoimento = async (req, res) => {
  const idUsuario = req.usuarioId;
  const { nota, texto } = req.body;

  const notaNum = Number(nota);
  if (!Number.isInteger(notaNum) || notaNum < 1 || notaNum > 5) {
    return res.status(400).json({ erro: 'Escolha uma nota de 1 a 5 estrelas.' });
  }

  try {
    const sql = await conectar();

    const textoLimpo = typeof texto === 'string' ? texto.trim().slice(0, 600) : '';

    await sql`
      INSERT INTO depoimentos (id_usuario, nota, texto)
      VALUES (${idUsuario}, ${notaNum}, ${textoLimpo})
      ON CONFLICT (id_usuario)
      DO UPDATE SET nota = EXCLUDED.nota, texto = EXCLUDED.texto, data_cadastro = NOW()
    `;

    const [dados] = await sql`
      SELECT COALESCE(AVG(nota), 0)::numeric(2,1) AS media, COUNT(*)::int AS total
      FROM depoimentos
      WHERE oculta = FALSE
    `;

    res.status(201).json({
      mensagem: 'Depoimento registrado com sucesso.',
      media: Number(dados.media),
      total: dados.total,
    });
  } catch (err) {
    console.error('ERRO criarDepoimento:', err);
    res.status(500).json({ erro: 'Não foi possível registrar o depoimento.' });
  }
};

module.exports = {
  listarDepoimentos,
  criarDepoimento,
};
