export type DataSourceKind = 'local-fixture' | 'approved-source' | 'disabled'

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
  profileUrl?: string
  attribution?: { provider: string; recordId: string; retrievedAt: string; reliability: 'aggregated-provider-data' }
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
  matchMode: 'exact' | 'prefix'
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
