import { Router } from 'express'
import { protect } from '../middleware/auth'
import type { DiscoveryProvider } from '../discovery/provider'
import { executeDiscovery } from '../controllers/discoveryController'

export function createDiscoveryRoutes(provider: DiscoveryProvider) {
  const router = Router()
  router.use(protect)
  router.post('/search', executeDiscovery(provider))
  return router
}
