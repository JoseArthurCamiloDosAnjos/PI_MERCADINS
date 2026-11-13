//  POST /api/upload/:categoria — recebe uma imagem (multipart/form-data,
const path = require('path');
const express = require('express');
const router = express.Router();
const autenticar = require('../middleware/authMiddleware');
const { upload, CATEGORIAS, RAIZ_IMAGENS } = require('../middleware/upload');
const { gerarThumb } = require('../utils/thumbs');

router.post('/:categoria', autenticar, (req, res) => {
  const { categoria } = req.params;
  if (!CATEGORIAS.includes(categoria)) {
    return res.status(400).json({ erro: 'Categoria de imagem inválida.' });
  }

  upload.single('imagem')(req, res, async (err) => {
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

    const proto = String(req.headers['x-forwarded-proto'] || req.protocol || 'http')
      .split(',')[0]
      .trim();
    const host = req.get('host');
    const caminho = `/imagens/${categoria}/${req.file.filename}`;
    const base = `${proto}://${host}`;

    const thumb = await gerarThumb(path.join(RAIZ_IMAGENS, categoria, req.file.filename));

    res.status(201).json({
      url: `${base}${caminho}`,
      ...(thumb ? { thumb: `${base}/imagens/${categoria}/thumbs/${req.file.filename}` } : {}),
      caminho,
    });
  });
});

module.exports = router;
