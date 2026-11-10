import { Router, text } from 'express'
import { protect } from '../middleware/auth'
import { createNetworkLimit } from '../middleware/networkLimit'
import { NetworkInputError } from '../network/types'
import * as controller from '../controllers/networkController'

export function createNetworkRoutes() {
  const router = Router()
  router.use(protect)
  router.use(createNetworkLimit())
  router.get('/', controller.status)
  router.get('/people', controller.listPeople)
  router.post(['/preview', '/import'], text({ type: 'text/csv', limit: '1mb', defaultCharset: 'utf-8' }), (req, _res, next) => {
    if (!req.is('text/csv')) throw new NetworkInputError('Use Content-Type: text/csv for connection imports.')
    next()
  })
  router.post('/preview', controller.preview)
  router.post('/import', controller.importCsv)
  router.delete('/', controller.removeNetwork)
  router.post('/candidate-links', controller.linkCandidate)
  router.delete('/candidate-links', controller.linkCandidate)
  return router
}
