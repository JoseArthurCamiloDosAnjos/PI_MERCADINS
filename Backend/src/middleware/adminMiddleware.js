const { conectar } = require('../db/neon')

module.exports = async (req, res, next) => {
  try {
    const sql = await conectar()
    const [usuario] = await sql`
      SELECT is_admin, status FROM usuarios
      WHERE id_usuario = ${req.usuarioId}
    `
    if (!usuario || !usuario.is_admin) {
      return res.status(403).json({ erro: 'Acesso restrito a administradores' })
    }

    if (usuario.status === 'bloqueado') {
      return res.status(403).json({ erro: 'Sua conta foi bloqueada', status: 'bloqueado' })
    }

    if (usuario.status === 'inativo') {
      return res.status(403).json({ erro: 'Sua conta está desativada', status: 'inativo' })
    }

    next()
  } catch {
    res.status(500).json({ erro: 'Erro ao verificar permissão de administrador' })
  }
}
