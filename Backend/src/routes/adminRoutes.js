const { Router } = require('express')
const authMiddleware = require('../middleware/authMiddleware')
const adminMiddleware = require('../middleware/adminMiddleware')
const adminController = require('../controllers/adminController')
const catalogoController = require('../controllers/catalogoController')

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
router.get('/mercados',        adminController.listarMercadosAdmin)
router.get('/mercados/:id',    adminController.detalheMercadoAdmin)
router.put('/mercados/:id/bloquear', adminController.bloquearMercado)

router.get('/catalogo',        catalogoController.listarCatalogoAdmin)
router.post('/catalogo',       catalogoController.criarItemCatalogo)
router.put('/catalogo/:id',    catalogoController.atualizarItemCatalogo)
router.delete('/catalogo/:id', catalogoController.deletarItemCatalogo)

module.exports = router
