import { ApiError, apiRequest } from './api'
import type { SavedSearch } from './history'

// The server owns discovery execution, provenance and saved snapshots.
export type DiscoverySource = 'approved-source' | 'local-fixture' | 'disabled'

export type DiscoveryPerson = {
  id: string
  name: string
  title?: string
  role?: string
  imageUrl?: string
  profileUrl?: string
  source: DiscoverySource
  isFixture?: boolean
  isCurrentUser?: boolean
  evidence?: readonly {
    provider: string; recordId: string; field: string; companyId: string; title: string
    affiliation: 'current' | 'historical' | 'unknown'
    startDate?: string; endDate?: string; lastSeen?: string; sourceCount?: number; profileUrl?: string
  }[]
  verification?: { confidence: 'provider-supported'; explanation: string; limitation: string }
}

export type DiscoveryCompany = {
  id: string
  name: string
  logoUrl?: string
  description?: string
  industry?: string
  website?: string
  source: DiscoverySource
  location?: string
  profileUrl?: string
  attribution?: { provider: string; recordId: string; retrievedAt: string; reliability: 'aggregated-provider-data' }
}

export type DiscoveryPath = {
  id: string
  startPersonId: string
  targetPersonId: string
  path: readonly string[]
  explanation?: string
  source: DiscoverySource
  isFixture?: boolean
  // Raw backend confidence is not a calculated path-strength score.
  calculatedStrength?: { score: number; explanation: string }
}

export type DiscoveryConnection = {
  id: string
  fromPersonId: string
  toPersonId: string
  relationship: 'direct' | 'warm' | 'introduced' | 'vouched' | 'unknown'
  notes?: string
  source: DiscoverySource
}

export type DiscoveryResult = {
  company: DiscoveryCompany
  targetPerson?: DiscoveryPerson
  // The domain result only has person IDs. An adapter must resolve those IDs
  // before the UI can show names, photos or relationships without inventing them.
  people: readonly DiscoveryPerson[]
  paths: readonly DiscoveryPath[] | null
  connections?: readonly DiscoveryConnection[]
  source: DiscoverySource
  generatedAt?: string
  warnings?: readonly string[]
  peopleStatus?: 'available' | 'no_candidates' | 'not_configured' | 'rate_limited' | 'provider_error' | 'provider_timeout' | 'provider_access_denied' | 'quota_exceeded'
  peopleTruncated?: boolean
  connectionStatus?: 'unavailable'
}

export type DiscoveryService = {
  available: boolean
  search: (companyName: string, options: { signal: AbortSignal; requestId: string }) => Promise<SavedSearch>
}

export const companyDiscovery: DiscoveryService = {
  // The API is callable even when its server-side provider is unconfigured.
  available: true,
  async search(companyName, { signal, requestId }) {
    try {
      return await apiRequest<SavedSearch>('/discovery/search', {
        method: 'POST', signal, headers: { 'Idempotency-Key': requestId }, body: JSON.stringify({ companyName }),
      })
    } catch (error) {
      // A failed discovery can still have a durable history record. Preserve it
      // rather than treating a recorded rate limit as an uncertain network failure.
      if (error instanceof ApiError && isSavedFailure(error.data)) return error.data
      throw error
    }
  },
}

function isSavedFailure(value: unknown): value is SavedSearch {
  if (!value || typeof value !== 'object') return false
  const record = value as Partial<SavedSearch>
  return typeof record.id === 'string' && record.status === 'failed' && typeof record.outcome === 'string'
    && typeof record.originalQuery === 'string' && record.result === null && Array.isArray(record.matches)
}

export function safeWebUrl(value?: string): string | undefined {
  if (!value) return undefined
  try {
    const url = new URL(value)
    return (url.protocol === 'https:' || url.protocol === 'http:') && !url.username && !url.password
      ? url.href : undefined
  } catch {
    return undefined
  }
}

export function isDemonstration(result: DiscoveryResult): boolean {
  return result.source === 'local-fixture' || result.company.source === 'local-fixture'
    || result.targetPerson?.source === 'local-fixture' || result.targetPerson?.isFixture === true
    || result.people.some(person => person.source === 'local-fixture' || person.isFixture)
    || result.paths?.some(path => path.source === 'local-fixture' || path.isFixture) === true
    || result.connections?.some(connection => connection.source === 'local-fixture') === true
}
