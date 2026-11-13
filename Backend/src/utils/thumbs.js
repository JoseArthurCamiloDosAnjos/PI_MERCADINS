//  Miniaturas das imagens ("thumbs")
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

const LADO_MAX_THUMB = 300;

const emAndamento = new Map();

function thumbDe(caminhoOriginal) {
  const dir = path.dirname(caminhoOriginal);
  const nome = path.basename(caminhoOriginal);
  return path.join(dir, 'thumbs', nome);
}

async function gerarThumb(caminhoOriginal) {
  const destino = thumbDe(caminhoOriginal);
  try {
    if (!fs.existsSync(caminhoOriginal)) return null;
    if (fs.existsSync(destino)) return destino;
    if (emAndamento.has(destino)) return emAndamento.get(destino);

    const promessa = (async () => {
      await fs.promises.mkdir(path.dirname(destino), { recursive: true });
      const pipeline = sharp(caminhoOriginal)
        .rotate()
        .resize({
          width: LADO_MAX_THUMB,
          height: LADO_MAX_THUMB,
          fit: 'inside',
          withoutEnlargement: true,
        });

      const ext = path.extname(destino).toLowerCase();
      if (ext === '.png') {
        await pipeline.png({ compressionLevel: 9 }).toFile(destino);
      } else if (ext === '.webp') {
        await pipeline.webp({ quality: 70 }).toFile(destino);
      } else {
        await pipeline.jpeg({ quality: 70, progressive: true }).toFile(destino);
      }
      return destino;
    })();

    emAndamento.set(destino, promessa);
    try {
      return await promessa;
    } finally {
      emAndamento.delete(destino);
    }
  } catch (falha) {
    console.warn('[thumbs] Falha ao gerar miniatura de', caminhoOriginal, '—', falha.message);
    return null;
  }
}

function middlewareThumbSobDemanda(raizImagens, categorias) {
  return (req, res, next) => {
    if (req.method !== 'GET') return next();
    const partes = req.path.split('/').filter(Boolean);
    if (partes.length !== 3 || partes[1] !== 'thumbs') return next();

    const [categoria, , arquivo] = partes;
    if (!categorias.includes(categoria)) return next();
    if (!/^[\w-]+\.(jpe?g|png|webp)$/i.test(arquivo)) return next();

    const original = path.join(raizImagens, categoria, arquivo);
    const alvo = path.join(raizImagens, categoria, 'thumbs', arquivo);
    if (!path.resolve(alvo).startsWith(path.resolve(raizImagens) + path.sep)) return next();
    if (fs.existsSync(alvo)) return next();
    if (!fs.existsSync(original)) return next();

    gerarThumb(original).then(() => next()).catch(() => next());
  };
}

module.exports = { gerarThumb, thumbDe, middlewareThumbSobDemanda, LADO_MAX_THUMB };
