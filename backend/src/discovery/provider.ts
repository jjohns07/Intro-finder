import type { DiscoverySearchResult, DiscoveryVerification } from './types'
import { PeopleDataLabsProvider } from './providers/peopleDataLabs'
import { SkrappProvider } from './providers/skrapp'

// Server-only adapter boundary. An enabled adapter must explicitly permit
// storage of the allowlisted result snapshot; no fixtures are used in production.
export interface DiscoveryProvider {
  name: string
  available: boolean
  snapshotAllowed: boolean
  configurationMessage?: string
  readonly verification?: DiscoveryVerification
  verifyConnection?(): Promise<DiscoveryVerification>
  search(query: string, options: { signal: AbortSignal }): Promise<DiscoverySearchResult>
}

export function createDiscoveryProvider(env: NodeJS.ProcessEnv = process.env): DiscoveryProvider {
  const selected = env.DISCOVERY_PROVIDER?.trim().toLowerCase()
  // Migrate an inactive PDL configuration when the replacement key is supplied.
  const inactivePdl = selected === 'pdl' && !env.PDL_API_KEY?.trim() && Boolean(env.SKRAPP_API_KEY?.trim())
  if (!selected || selected === 'skrapp' || inactivePdl) return new SkrappProvider({
    apiKey: env.SKRAPP_API_KEY ?? '',
    executivesEnabled: env.SKRAPP_EXECUTIVE_SEARCH_ENABLED !== 'false',
    searchRequestsPerMinute: Number(env.SKRAPP_SEARCH_REQUESTS_PER_MINUTE ?? 20),
    searchRequestsPerDay: Number(env.SKRAPP_SEARCH_REQUESTS_PER_DAY ?? 50),
  })
  if (selected === 'pdl') return new PeopleDataLabsProvider(env)
  return {
    name: 'unconfigured', available: false, snapshotAllowed: false,
    configurationMessage: 'Company discovery is not configured. No provider search was performed.',
    async search() { throw new Error('Company discovery is not configured.') },
  }
}

export function shouldVerifyOnStartup(provider: DiscoveryProvider, env: NodeJS.ProcessEnv = process.env) {
  return env.RENDER === 'true' && env.SKRAPP_VERIFY_ON_STARTUP !== 'false'
    && provider.name === 'skrapp' && provider.available && Boolean(provider.verifyConnection)
}
