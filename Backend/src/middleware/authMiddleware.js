const jwt = require('jsonwebtoken')
const { conectar } = require('../db/neon')

module.exports = async (req, res, next) => {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ erro: 'Token não fornecido' })
  }

  const token = authHeader.split(' ')[1]

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET)
    req.usuario = payload
    req.usuarioId = payload.id

    const sql = await conectar()
    const [usuario] = await sql`
      SELECT status FROM usuarios WHERE id_usuario = ${payload.id}
    `

    if (!usuario) {
      return res.status(401).json({ erro: 'Usuário não encontrado' })
    }

    if (usuario.status === 'bloqueado') {
      return res.status(403).json({ erro: 'Sua conta foi bloqueada', status: 'bloqueado' })
    }

    if (usuario.status === 'inativo') {
      return res.status(403).json({ erro: 'Sua conta está desativada', status: 'inativo' })
    }

    next()
  } catch {
    res.status(401).json({ erro: 'Token inválido ou expirado' })
  }
}
