const { Router } = require('express')
const { listarCatalogo } = require('../controllers/catalogoController')

const router = Router()

router.get('/', listarCatalogo)

module.exports = router
