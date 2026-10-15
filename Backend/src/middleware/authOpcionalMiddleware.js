const jwt = require('jsonwebtoken')

// Autentica quando há token válido, mas continua sem usuário se não houver.
// Usado em rotas públicas que precisam saber quem está logado (ex.: favoritos).
module.exports = (req, res, next) => {
  const authHeader = req.headers.authorization

  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const payload = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET)
      req.usuario = payload
      req.usuarioId = payload.id
    } catch {
      // token inválido/expirado: segue como anônimo
    }
  }

  next()
}
