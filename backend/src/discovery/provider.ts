import type { DiscoveryResult } from './types'

// Server-only adapter boundary. An enabled adapter must explicitly permit
// storage of the allowlisted result snapshot; no fixtures are used in production.
export interface DiscoveryProvider {
  name: string
  available: boolean
  snapshotAllowed: boolean
  search(query: string, options: { signal: AbortSignal }): Promise<DiscoveryResult | null>
}

export const discoveryProvider: DiscoveryProvider = {
  name: 'unconfigured',
  available: false,
  snapshotAllowed: false,
  async search() { throw new Error('Company discovery is not configured.') },
}
