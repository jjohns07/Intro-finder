import type { ProviderFailure } from './errors'

export type DataSourceKind = 'local-fixture' | 'approved-source' | 'disabled'
export type CompanyMatchMode = 'exact' | 'prefix' | 'relevance'
export interface DiscoveryVerification {
  status: 'not_run' | 'running' | 'passed' | 'partial' | 'failed'
  companySearch: 'not_run' | 'passed' | 'no_data' | 'not_configured' | ProviderFailure
  executiveEnrichment: 'not_run' | 'passed' | 'no_data' | 'not_configured' | ProviderFailure
  executiveCount?: number
  checkedAt?: string
}

export interface CompanyInformationVerification {
  status: 'not_run' | 'running' | 'passed' | 'partial' | 'failed'
  checkedAt?: string
  companies: {
    name: string
    domain: string
    status: 'not_run' | 'passed' | 'no_match' | 'no_data' | 'needs_review' | 'not_configured' | ProviderFailure
    description?: 'available' | 'unavailable'
    country?: 'matched' | 'different' | 'unavailable'
    industry?: 'available' | 'unavailable'
    fields?: string[]
  }[]
}

export type PersonRole =
  | 'founder'
  | 'executive'
  | 'operator'
  | 'investor'
  | 'team-member'
  | 'advisor'
  | 'unknown'

export type RelationshipStrength = 'direct' | 'warm' | 'introduced' | 'vouched' | 'unknown'

export type PathType = 'direct' | 'warm' | 'team' | 'advisor' | 'unknown'

export interface Person {
  id: string
  name: string
  title?: string
  companyId?: string
  role?: PersonRole
  email?: string
  source: DataSourceKind
  isFixture?: boolean
  metadata?: Record<string, unknown>
  imageUrl?: string
  profileUrl?: string
  isCurrentUser?: boolean
  evidence?: EmploymentEvidence[]
  verification?: { confidence: 'provider-supported'; explanation: string; limitation: string }
}

export interface Company {
  id: string
  name: string
  website?: string
  industry?: string
  description?: string
  logoUrl?: string
  source: DataSourceKind
  metadata?: Record<string, unknown>
  location?: string
  country?: string
  city?: string
  region?: string
  domain?: string
  employeeRange?: string
  // This is a LinkedIn membership count, not the company's actual headcount.
  linkedinEmployeeCount?: number
  legalName?: string
  companyType?: string
  foundedYear?: number
  activityStatus?: string
  profileUrl?: string
  attribution?: { provider: string; recordId: string; retrievedAt: string; reliability: 'aggregated-provider-data' }
}

export interface CompanyDetails {
  status: 'available' | 'unavailable' | 'not_configured' | ProviderFailure
  // Kept separately from the search card so missing or failed enrichment cannot
  // overwrite the original company match, its sources, or its people.
  company?: Company
  checkedAt: string
  retrievedAt?: string
  providerUpdatedAt?: string
  expiresAt?: string
  cached: boolean
  profileSource?: 'firmographics' | 'snapshot'
  // A free snapshot can succeed while the description-bearing category fails.
  enrichmentStatus?: ProviderFailure
  descriptionField?: 'description' | 'description_short' | 'meta_description'
  retryAfterSeconds?: number
}

export interface EmploymentEvidence {
  provider: string
  recordId: string
  field: string
  companyId: string
  title: string
  affiliation: 'current' | 'historical' | 'unknown'
  startDate?: string
  endDate?: string
  lastSeen?: string
  sourceCount?: number
  profileUrl?: string
}

export type PeopleStatus = 'available' | 'no_candidates' | 'not_configured' | 'rate_limited' | 'provider_error' | 'provider_timeout' | 'provider_access_denied' | 'quota_exceeded'
export interface DiscoverySearchResult {
  matches: DiscoveryResult[]
  total: number
  matchMode: CompanyMatchMode
}

export interface Connection {
  id: string
  fromPersonId: string
  toPersonId: string
  relationship: RelationshipStrength
  strength?: number
  source: DataSourceKind
  notes?: string
  metadata?: Record<string, unknown>
}

export interface IntroductionPath {
  id: string
  startPersonId: string
  targetPersonId: string
  path: string[]
  pathType?: PathType
  confidence?: number
  explanation?: string
  calculatedStrength?: { score: number; explanation: string }
  source: DataSourceKind
  isFixture?: boolean
}

export interface DiscoveryRequest {
  companyName: string
  userId?: string
  limit?: number
  includeFixtures?: boolean
}

export interface DiscoveryResult {
  company: Company
  companyDetails?: CompanyDetails
  targetPerson?: Person
  people?: Person[]
  connections?: Connection[]
  paths: IntroductionPath[] | null
  source: DataSourceKind
  generatedAt: string
  warnings: string[]
  peopleStatus?: PeopleStatus
  peopleTruncated?: boolean
  connectionStatus?: 'unavailable'
}

export interface SocialPlatformAdapter {
  readonly platformName: 'x' | 'linkedin' | 'approved-source' | 'local-fixture'
  readonly isEnabled: boolean
  discoverPeople(query: string): Promise<Person[]>
  discoverCompany(query: string): Promise<Company | null>
}

export interface DiscoveryEngineConfig {
  allowLocalFixtures: boolean
  allowApprovedSource: boolean
  disabledPlatforms: Array<'x' | 'linkedin'>
}
