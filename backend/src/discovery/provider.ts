import type { DiscoverySearchResult } from './types'
import { PeopleDataLabsProvider } from './providers/peopleDataLabs'

// Server-only adapter boundary. An enabled adapter must explicitly permit
// storage of the allowlisted result snapshot; no fixtures are used in production.
export interface DiscoveryProvider {
  name: string
  available: boolean
  snapshotAllowed: boolean
  configurationMessage?: string
  search(query: string, options: { signal: AbortSignal }): Promise<DiscoverySearchResult>
}

export function createDiscoveryProvider(env: NodeJS.ProcessEnv = process.env): DiscoveryProvider {
  if (env.DISCOVERY_PROVIDER === 'pdl') return new PeopleDataLabsProvider(env)
  return {
    name: 'unconfigured', available: false, snapshotAllowed: false,
    configurationMessage: 'Company discovery is not configured. No provider search was performed.',
    async search() { throw new Error('Company discovery is not configured.') },
  }
}
