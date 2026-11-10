// ─────────────────────────────────────────────────────────────────────────────
//  Upload local de imagens — pasta "imagens" dentro do Backend
//
//  Aceita apenas PNG, JPG e WEBP (máx. 5 MB) e guarda o arquivo em
//  Backend/imagens/<categoria>/ com nome único (timestamp + aleatório). A rota
//  devolve a URL pública (/imagens/...), que é o que fica gravado no banco.
//
//  A pasta pode ser movida com a variável IMAGENS_DIR (caminho absoluto ou
//  relativo à pasta Backend) — sem ela, usa Backend/imagens.
// ─────────────────────────────────────────────────────────────────────────────
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// Backend/ (padrão: Backend/imagens) — IMAGENS_DIR sobrescreve quando quiser
// guardar as imagens em outro lugar (ex.: disco externo ou volume do servidor);
// caminho relativo é resolvido a partir da pasta Backend.
const BACKEND = path.resolve(__dirname, '../..');
const RAIZ_IMAGENS = process.env.IMAGENS_DIR
  ? path.resolve(BACKEND, process.env.IMAGENS_DIR)
  : path.join(BACKEND, 'imagens');

// Garante a pasta na subida do servidor (também cria no container)
fs.mkdirSync(RAIZ_IMAGENS, { recursive: true });

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
