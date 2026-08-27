const multer = require('multer')
const path = require('path')
const fs = require('fs')

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let pasta = 'uploads/outros'
    if (req.baseUrl.includes('produtos')) pasta = 'uploads/produtos'
    else if (req.baseUrl.includes('mercados')) pasta = 'uploads/mercados'
    else if (req.baseUrl.includes('auth') || req.baseUrl.includes('usuario')) pasta = 'uploads/usuarios'

    const caminhoCompleto = path.resolve(__dirname, '..', '..', pasta)
    fs.mkdirSync(caminhoCompleto, { recursive: true })
    cb(null, caminhoCompleto)
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname)
    const nome = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`
    cb(null, nome)
  }
})

const fileFilter = (req, file, cb) => {
  const permitidos = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  if (permitidos.includes(file.mimetype)) {
    cb(null, true)
  } else {
    cb(new Error('Tipo de arquivo não permitido. Use JPG, PNG, WEBP ou GIF.'))
  }
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }
})

module.exports = upload
