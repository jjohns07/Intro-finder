import { apiRequest, ApiError } from './api'
import type { DiscoveryResult } from './discovery'

export type IntroductionStatus = 'available' | 'network_not_imported' | 'candidate_not_identified' | 'candidate_provider_error'
  | 'identity_unresolved' | 'no_path' | 'search_limited' | 'network_error'
export type IdentityEvidence = { personId: string; name: string; profileUrl?: string; verification: 'user_confirmed'; statement: string; confirmedAt: string }
export type IntroductionReport = {
  status: IntroductionStatus; socialIntegration: 'unavailable'; networkRevision?: number; networkUpdatedAt?: string
  maxDepth: number; maxPathsPerCandidate: number; limited: boolean
  excluded?: { follows: number; unverified: number; stale: number }
  candidates: { candidateId: string; status: 'available' | 'identity_unresolved' | 'no_path' | 'search_limited'; identity?: IdentityEvidence }[]
}
export type NetworkStatus = { imported: boolean; revision: number; personCount: number; relationshipCount: number; updatedAt?: string; source: 'csv' | null; socialIntegration: 'unavailable' }
export type NetworkContact = { localId: string; name: string; title?: string; profileUrl?: string; createdAt?: string; updatedAt?: string }
export type NetworkPeople = NetworkStatus & { people: NetworkContact[]; total: number }
export type NetworkPreview = { personCount: number; relationshipCount: number; confirmedCount: number; people: NetworkContact[] }

async function pathResponse(path: string, body: unknown, companyId: string, method = 'POST') {
  const result = await apiRequest<DiscoveryResult>(path, { method, body: JSON.stringify(body) })
  if (result.company?.id !== companyId || !Array.isArray(result.people) || !Array.isArray(result.paths) || !Array.isArray(result.connections) || !result.introduction) throw new ApiError('Invalid introduction-path response.', 502)
  return result
}

export const networkService = {
  status: (signal?: AbortSignal) => apiRequest<NetworkStatus>('/network', { signal }),
  people: (q = '', page = 1, signal?: AbortSignal) => apiRequest<NetworkPeople>(`/network/people?q=${encodeURIComponent(q)}&page=${page}`, { signal }),
  preview: (csv: string) => apiRequest<NetworkPreview>('/network/preview', { method: 'POST', headers: { 'Content-Type': 'text/csv' }, body: csv }),
  importCsv: (csv: string, revision: number) => apiRequest<NetworkStatus & { unchanged: boolean }>('/network/import', { method: 'POST',
    headers: { 'Content-Type': 'text/csv', 'X-Network-Revision': String(revision), 'X-Import-Confirmed': 'true' }, body: csv }),
  remove: (revision: number) => apiRequest<NetworkStatus>('/network', { method: 'DELETE', body: JSON.stringify({ revision }) }),
  refreshPaths: (searchId: string, companyId: string) => pathResponse('/discovery/paths', { searchId, companyId }, companyId),
  link: (data: { searchId: string; companyId: string; candidateId: string; personId: string; revision: number; statement: string; confirmed: true }) => pathResponse('/network/candidate-links', data, data.companyId),
  unlink: (data: { searchId: string; companyId: string; candidateId: string; revision: number }) => pathResponse('/network/candidate-links', data, data.companyId, 'DELETE'),
}

export const NETWORK_CSV_HEADER = 'source_id,source_name,source_profile_url,destination_id,destination_name,destination_profile_url,relationship_type,verification_status,evidence,observed_at'
