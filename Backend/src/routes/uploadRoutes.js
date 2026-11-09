// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/upload/:categoria — recebe uma imagem (multipart/form-data,
//  campo "imagem"), salva na pasta imagens/<categoria>/ e devolve a URL.
//
//  Categorias: produtos | mercados | usuarios | avaliacoes | catalogo
//  Formatos: PNG, JPG, WEBP — até 5 MB.
// ─────────────────────────────────────────────────────────────────────────────
const express = require('express');
const router = express.Router();
const autenticar = require('../middleware/authMiddleware');
const { upload, CATEGORIAS } = require('../middleware/upload');

router.post('/:categoria', autenticar, (req, res) => {
  const { categoria } = req.params;
  if (!CATEGORIAS.includes(categoria)) {
    return res.status(400).json({ erro: 'Categoria de imagem inválida.' });
  }

  upload.single('imagem')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ erro: 'Imagem muito grande. O limite é 5 MB.' });
      }
      return res.status(400).json({ erro: err.message || 'Falha ao enviar a imagem.' });
    }
    if (!req.file) {
      return res
        .status(400)
        .json({ erro: 'Nenhuma imagem enviada. Use o campo "imagem" (PNG, JPG ou WEBP).' });
    }

    // URL absoluta derivada do próprio request: o mesmo host usado para
    // chamar a API serve as imagens (GET /imagens/...).
    const proto = String(req.headers['x-forwarded-proto'] || req.protocol || 'http')
      .split(',')[0]
      .trim();
    const host = req.get('host');
    const caminho = `/imagens/${categoria}/${req.file.filename}`;

    res.status(201).json({ url: `${proto}://${host}${caminho}`, caminho });
  });
});

module.exports = router;
