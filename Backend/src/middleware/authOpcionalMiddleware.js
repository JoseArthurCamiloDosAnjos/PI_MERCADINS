const jwt = require('jsonwebtoken')

module.exports = (req, res, next) => {
  const authHeader = req.headers.authorization

  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const payload = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET)
      req.usuario = payload
      req.usuarioId = payload.id
    } catch { /* falha ignorada */ }
  }

  next()
}
