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
}

export interface Company {
  id: string
  name: string
  website?: string
  industry?: string
  source: DataSourceKind
  metadata?: Record<string, unknown>
}

export interface Connection {
  id: string
  fromPersonId: string
  toPersonId: string
  relationship: RelationshipStrength
  strength: number
  source: DataSourceKind
  notes?: string
  metadata?: Record<string, unknown>
}

export interface IntroductionPath {
  id: string
  startPersonId: string
  targetPersonId: string
  path: string[]
  pathType: PathType
  confidence: number
  explanation: string
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
  paths: IntroductionPath[]
  source: DataSourceKind
  generatedAt: string
  warnings: string[]
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
