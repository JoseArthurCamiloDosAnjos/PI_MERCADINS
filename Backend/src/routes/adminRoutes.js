const { Router } = require('express')
const authMiddleware = require('../middleware/authMiddleware')
const adminMiddleware = require('../middleware/adminMiddleware')
const adminController = require('../controllers/adminController')

const router = Router()

router.use(authMiddleware, adminMiddleware)

router.get('/dashboard',    adminController.dashboard)
router.get('/usuarios',     adminController.listarUsuarios)
router.get('/usuarios/:id', adminController.detalhesUsuario)
router.put('/usuarios/:id', adminController.editarUsuario)
router.put('/usuarios/:id/bloquear', adminController.bloquearUsuario)
router.put('/usuarios/:id/status',   adminController.statusUsuario)
router.delete('/usuarios/:id',       adminController.excluirUsuario)
router.get('/relatorios',   adminController.relatorios)
router.get('/atividade',    adminController.atividadeRecente)
router.get('/alertas',      adminController.alertas)
router.put('/mercados/:id/bloquear', adminController.bloquearMercado)

module.exports = router
