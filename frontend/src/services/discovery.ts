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
  country?: string
  city?: string
  region?: string
  domain?: string
  employeeRange?: string
  linkedinEmployeeCount?: number
  legalName?: string
  companyType?: string
  foundedYear?: number
  activityStatus?: string
  profileUrl?: string
  attribution?: { provider: string; recordId: string; retrievedAt: string; reliability: 'aggregated-provider-data' }
}

export type DiscoveryCompanyDetails = {
  status: 'available' | 'unavailable' | 'not_configured' | 'provider_error' | 'provider_timeout' | 'rate_limited' | 'provider_access_denied' | 'quota_exceeded'
  company?: DiscoveryCompany
  checkedAt: string
  retrievedAt?: string
  providerUpdatedAt?: string
  expiresAt?: string
  cached: boolean
  profileSource?: 'firmographics' | 'snapshot'
  enrichmentStatus?: 'provider_error' | 'provider_timeout' | 'rate_limited' | 'provider_access_denied' | 'quota_exceeded'
  descriptionField?: 'description' | 'description_short' | 'meta_description'
  retryAfterSeconds?: number
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
  companyDetails?: DiscoveryCompanyDetails
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
  getCompanyDetails?: (searchId: string, companyId: string, options: { signal: AbortSignal; refresh?: boolean }) => Promise<DiscoveryCompanyDetails>
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
  async getCompanyDetails(searchId, companyId, { signal, refresh = false }) {
    const details = await apiRequest<DiscoveryCompanyDetails>('/discovery/company-details', {
      method: 'POST', signal, body: JSON.stringify({ searchId, companyId, refresh }),
    })
    if (!details || !['available', 'unavailable', 'not_configured', 'provider_error', 'provider_timeout', 'rate_limited', 'provider_access_denied', 'quota_exceeded'].includes(details.status)
      || typeof details.checkedAt !== 'string' || !Number.isFinite(Date.parse(details.checkedAt)) || typeof details.cached !== 'boolean'
      || (details.status === 'available' && !details.company)
      || (details.status === 'unavailable' && details.company)
      || (details.company && (details.company.id !== companyId || !validCompany(details.company)))
      || (details.profileSource !== undefined && !['firmographics', 'snapshot'].includes(details.profileSource))
      || (details.enrichmentStatus !== undefined && (details.profileSource !== 'snapshot'
        || !['provider_error', 'provider_timeout', 'rate_limited', 'provider_access_denied', 'quota_exceeded'].includes(details.enrichmentStatus)))
      || (details.profileSource === 'snapshot' && (details.company?.description || details.descriptionField))
      || (details.descriptionField !== undefined && (!['description', 'description_short', 'meta_description'].includes(details.descriptionField) || !details.company?.description))
      || ['retrievedAt', 'providerUpdatedAt', 'expiresAt'].some(field => {
        const value = details[field as keyof DiscoveryCompanyDetails]
        return value !== undefined && (typeof value !== 'string' || !Number.isFinite(Date.parse(value)))
      })) {
      throw new ApiError('The server returned invalid company information. Please try again.', 502)
    }
    return details
  },
}

function validCompany(company: DiscoveryCompany) {
  return typeof company.name === 'string' && Boolean(company.name.trim()) && company.source === 'approved-source'
    && ['description', 'industry', 'website', 'logoUrl', 'location', 'country', 'city', 'region', 'domain', 'employeeRange',
      'legalName', 'companyType', 'activityStatus', 'profileUrl'].every(field => {
      const value = company[field as keyof DiscoveryCompany]
      return value === undefined || typeof value === 'string'
    })
    && (company.linkedinEmployeeCount === undefined || (Number.isSafeInteger(company.linkedinEmployeeCount) && company.linkedinEmployeeCount >= 0))
    && (company.foundedYear === undefined || (Number.isSafeInteger(company.foundedYear) && company.foundedYear > 0 && company.foundedYear <= 9999))
    && (company.attribution === undefined || (company.attribution?.recordId === company.id
      && typeof company.attribution.provider === 'string' && Number.isFinite(Date.parse(company.attribution.retrievedAt))
      && company.attribution.reliability === 'aggregated-provider-data'))
}

export function mergeCompanyInformation(search: DiscoveryCompany, profile?: DiscoveryCompany): DiscoveryCompany {
  if (!profile || profile.id !== search.id) return search
  const company = { ...search, ...Object.fromEntries(Object.entries(profile).filter(([, value]) => value != null)) }
  // Headquarters is one source record. Mixing an old city/address with a newer
  // country or region can display a location neither response ever supplied.
  const headquarters = ['country', 'city', 'region', 'location'] as const
  if (headquarters.some(field => profile[field])) headquarters.forEach(field => { company[field] = profile[field] })
  return company
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
