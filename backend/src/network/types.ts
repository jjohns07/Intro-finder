export const NETWORK_LIMITS = { rows: 1000, people: 1500, depth: 4, pathsPerTarget: 3, targets: 5, visits: 10_000, evidenceDays: 365 } as const
export const RELATIONSHIP_TYPES = ['direct_connection', 'follows', 'mutual_follow', 'user_confirmed'] as const
export type NetworkRelationshipType = typeof RELATIONSHIP_TYPES[number]
export type RelationshipVerification = 'unverified' | 'user_confirmed'
export interface ImportedPerson { localId: string; name: string; profileUrl?: string; title?: string }
export interface ImportedRelationship {
  from: string; to: string; type: NetworkRelationshipType; verification: RelationshipVerification
  evidence: string; observedAt: string; row: number
}
export interface RelationshipEvidence {
  source: 'csv'; verification: RelationshipVerification; statement: string
  observedAt: string; importedAt: string; updatedAt: string
}
export interface CandidateIdentityEvidence {
  personId: string; name: string; profileUrl?: string
  verification: 'user_confirmed'; statement: string; confirmedAt: string
}
export type IntroductionStatus = 'available' | 'network_not_imported' | 'candidate_not_identified'
  | 'candidate_provider_error' | 'identity_unresolved' | 'no_path' | 'search_limited' | 'network_error'
export interface IntroductionReport {
  status: IntroductionStatus
  socialIntegration: 'unavailable'
  networkRevision?: number
  networkUpdatedAt?: string
  maxDepth: number
  maxPathsPerCandidate: number
  limited: boolean
  excluded?: { follows: number; unverified: number; stale: number }
  candidates: { candidateId: string; status: 'available' | 'identity_unresolved' | 'no_path' | 'search_limited'; identity?: CandidateIdentityEvidence }[]
}
export class NetworkInputError extends Error {
  constructor(message: string, readonly status = 400) { super(message) }
}
