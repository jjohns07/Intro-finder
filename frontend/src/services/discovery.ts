import { apiRequest } from './api'
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
}

export type DiscoveryCompany = {
  id: string
  name: string
  logoUrl?: string
  description?: string
  industry?: string
  website?: string
  source: DiscoverySource
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
}

export type DiscoveryService = {
  available: boolean
  search: (companyName: string, options: { signal: AbortSignal; requestId: string }) => Promise<SavedSearch>
}

export const companyDiscovery: DiscoveryService = {
  available: true,
  search: (companyName, { signal, requestId }) => apiRequest<SavedSearch>('/discovery/search', {
    method: 'POST', signal,
    headers: { 'Idempotency-Key': requestId },
    body: JSON.stringify({ companyName }),
  }),
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
