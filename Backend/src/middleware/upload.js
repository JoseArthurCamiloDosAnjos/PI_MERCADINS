// ─────────────────────────────────────────────────────────────────────────────
//  Upload local de imagens — pasta "imagens" na raiz do projeto
//
//  Aceita apenas PNG, JPG e WEBP (máx. 5 MB) e guarda o arquivo em
//  imagens/<categoria>/ com nome único (timestamp + aleatório). A rota
//  devolve a URL pública (/imagens/...), que é o que fica gravado no banco.
// ─────────────────────────────────────────────────────────────────────────────
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// Raiz do projeto: Pi_Mercadins/imagens
const RAIZ_IMAGENS = path.resolve(__dirname, '../../../imagens');

// Categorias aceitas = subpastas de imagens/
const CATEGORIAS = ['produtos', 'mercados', 'usuarios', 'avaliacoes', 'catalogo'];

const MIME_EXTENSOES = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

const upload = multer({
  storage: multer.diskStorage({
    destination(req, _file, cb) {
      try {
        const destino = path.join(RAIZ_IMAGENS, String(req.params.categoria || ''));
        fs.mkdirSync(destino, { recursive: true });
        cb(null, destino);
      } catch (falha) {
        cb(falha);
      }
    },
    filename(_req, file, cb) {
      const ext = MIME_EXTENSOES[file.mimetype] || path.extname(file.originalname).toLowerCase();
      const nome = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`;
      cb(null, nome);
    },
  }),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB
    files: 1,
  },
  fileFilter(_req, file, cb) {
    if (!MIME_EXTENSOES[file.mimetype]) {
      return cb(new Error('Formato não permitido. Envie uma imagem PNG, JPG ou WEBP.'));
    }
    cb(null, true);
  },
});

module.exports = { upload, CATEGORIAS, RAIZ_IMAGENS };
