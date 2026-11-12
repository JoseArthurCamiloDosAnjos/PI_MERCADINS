// ─────────────────────────────────────────────────────────────────────────────
//  Miniaturas das imagens ("thumbs")
//
//  Para cada imagem em imagens/<categoria>/arquivo.jpg gera, em
//  imagens/<categoria>/thumbs/arquivo.jpg, uma versão de no máximo
//  300×300 px (sem ampliar) — é o que o front usa nos cards, miniaturas e
//  carrinho via srcset, deixando o arquivo original só para as visões
//  grandes (galeria, banner).
//
//  gerarThumb(caminhoOriginal) → caminho do thumb ou null (best effort:
//  falha na geração nunca derruba o upload/request).
// ─────────────────────────────────────────────────────────────────────────────
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

const LADO_MAX_THUMB = 300;

// Serializa gerações concorrentes do mesmo arquivo (dois requests ao mesmo
// tempo pedindo o mesmo thumb — ex.: página com 20 cards legados).
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
        .rotate() // respeita a orientação EXIF
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

// Express middleware: em GET /imagens/<categoria>/thumbs/<arquivo> gera a
// miniatura sob demanda quando ela ainda não existe (imagens antigas, feitas
// antes deste recurso) e deixa o express.static servir em seguida.
function middlewareThumbSobDemanda(raizImagens, categorias) {
  return (req, res, next) => {
    if (req.method !== 'GET') return next();
    const partes = req.path.split('/').filter(Boolean); // ['produtos','thumbs','x.jpg']
    if (partes.length !== 3 || partes[1] !== 'thumbs') return next();

    const [categoria, , arquivo] = partes;
    if (!categorias.includes(categoria)) return next();
    if (!/^[\w-]+\.(jpe?g|png|webp)$/i.test(arquivo)) return next();

    const original = path.join(raizImagens, categoria, arquivo);
    const alvo = path.join(raizImagens, categoria, 'thumbs', arquivo);
    // Caminho resolvido precisa continuar dentro da pasta de imagens.
    if (!path.resolve(alvo).startsWith(path.resolve(raizImagens) + path.sep)) return next();
    if (fs.existsSync(alvo)) return next();
    if (!fs.existsSync(original)) return next();

    gerarThumb(original).then(() => next()).catch(() => next());
  };
}

module.exports = { gerarThumb, thumbDe, middlewareThumbSobDemanda, LADO_MAX_THUMB };
