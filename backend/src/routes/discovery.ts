import { Router } from 'express'
import { protect } from '../middleware/auth'
import type { DiscoveryProvider } from '../discovery/provider'
import { executeDiscovery } from '../controllers/discoveryController'
import { loadCompanyDetails } from '../controllers/companyDetailsController'

export function createDiscoveryRoutes(provider: DiscoveryProvider) {
  const router = Router()
  router.use(protect)
  router.post('/search', executeDiscovery(provider))
  router.post('/company-details', loadCompanyDetails(provider))
  return router
}
