import { Router } from 'express'
import { protect } from '../middleware/auth'
import type { DiscoveryProvider } from '../discovery/provider'
import { executeDiscovery } from '../controllers/discoveryController'
import { loadCompanyDetails } from '../controllers/companyDetailsController'
import { refreshPaths } from '../controllers/networkController'
import { createNetworkLimit } from '../middleware/networkLimit'

export function createDiscoveryRoutes(provider: DiscoveryProvider) {
  const router = Router()
  router.use(protect)
  router.post('/search', executeDiscovery(provider))
  router.post('/company-details', loadCompanyDetails(provider))
  router.post('/paths', createNetworkLimit(), refreshPaths)
  return router
}
