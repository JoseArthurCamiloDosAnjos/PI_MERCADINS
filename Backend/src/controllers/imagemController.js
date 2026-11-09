const crypto = require('crypto');
const { conectar } = require('../db/neon');

const LIMITE_BYTES = 3 * 1024 * 1024;
const TIPOS_ACEITOS = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

function detectarTipo(buffer) {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'image/png';
  }
  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp';
  }
  const inicio = buffer.toString('ascii', 0, 6);
  if (inicio === 'GIF87a' || inicio === 'GIF89a') {
    return 'image/gif';
  }
  return null;
}

function urlPublica(req, id) {
  const proto = String(req.headers['x-forwarded-proto'] || req.protocol || 'http')
    .split(',')[0]
    .trim();
  const host = String(req.headers['x-forwarded-host'] || req.get('host') || '')
    .split(',')[0]
    .trim();
  return `${proto}://${host}/api/imagens/${id}`;
}

const enviarImagem = async (req, res) => {
  try {
    const { dados } = req.body || {};
    if (typeof dados !== 'string' || !dados.trim()) {
      return res.status(400).json({ erro: 'Envie a imagem em base64 no campo "dados".' });
    }

    const base64 = dados.includes(',') ? dados.slice(dados.indexOf(',') + 1) : dados;
    const limpo = base64.replace(/\s+/g, '');
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(limpo)) {
      return res.status(400).json({ erro: 'Imagem em base64 inválida.' });
    }

    const buffer = Buffer.from(limpo, 'base64');
    if (!buffer.length) {
      return res.status(400).json({ erro: 'Imagem vazia.' });
    }
    if (buffer.length > LIMITE_BYTES) {
      return res.status(413).json({
        erro: 'Imagem muito grande depois de comprimida. O limite é 3 MB.',
      });
    }

    const mime = detectarTipo(buffer);
    if (!mime || !TIPOS_ACEITOS.includes(mime)) {
      return res.status(400).json({
        erro: 'Formato não suportado. Envie JPEG, PNG, WEBP ou GIF.',
      });
    }

    const hash = crypto.createHash('sha256').update(buffer).digest('hex');
    const sql = await conectar();

    const [existente] = await sql`
      SELECT id_imagem FROM imagens WHERE hash = ${hash}
    `;
    if (existente) {
      return res.json({
        id: existente.id_imagem,
        url: urlPublica(req, existente.id_imagem),
        reaproveitada: true,
      });
    }

    const [criada] = await sql`
      INSERT INTO imagens (hash, mime, tamanho, dados, id_usuario)
      VALUES (${hash}, ${mime}, ${buffer.length}, ${buffer}, ${req.usuarioId ?? null})
      ON CONFLICT (hash) DO UPDATE SET hash = EXCLUDED.hash
      RETURNING id_imagem
    `;

    return res.status(201).json({
      id: criada.id_imagem,
      url: urlPublica(req, criada.id_imagem),
      reaproveitada: false,
    });
  } catch (err) {
    console.error('ERRO enviarImagem:', err);
    return res.status(500).json({ erro: 'Não foi possível salvar a imagem.' });
  }
};

const buscarImagem = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(404).json({ erro: 'Imagem não encontrada.' });
    }

    const sql = await conectar();
    const [imagem] = await sql`
      SELECT dados, mime, hash FROM imagens WHERE id_imagem = ${id}
    `;
    if (!imagem) {
      return res.status(404).json({ erro: 'Imagem não encontrada.' });
    }

    const bytes = Buffer.isBuffer(imagem.dados)
      ? imagem.dados
      : Buffer.from(imagem.dados);
    const etag = `"${String(imagem.hash).trim()}"`;

    res.setHeader('Content-Type', imagem.mime);
    res.setHeader('Content-Length', bytes.length);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('ETag', etag);
    res.setHeader('Content-Disposition', 'inline');

    if (req.headers['if-none-match'] === etag) {
      return res.status(304).end();
    }

    return res.end(bytes);
  } catch (err) {
    console.error('ERRO buscarImagem:', err);
    return res.status(500).json({ erro: 'Não foi possível carregar a imagem.' });
  }
};

module.exports = { enviarImagem, buscarImagem };
