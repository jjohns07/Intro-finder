import type { RecentSearch } from '../components/dashboard/data'
import type { DiscoveryResult } from './discovery'
import { apiRequest } from './api'

export type SearchOutcome = 'success' | 'no_matches' | 'provider_unavailable' | 'provider_error'
export type HistoryFilters = { q?: string; status?: 'all' | 'pending' | 'completed' | 'failed'; sort?: 'recent' | 'oldest'; page?: number; pageSize?: number }
export type SavedSearch = RecentSearch & {
  originalQuery: string
  normalizedCompanyName: string
  updatedAt: string
  outcome: SearchOutcome | null
  message?: string
  provenance: { provider: string; source: 'approved-source' | 'disabled'; snapshotVersion: number }
  result: DiscoveryResult | null
}

export type SearchHistorySnapshot = {
  records: readonly RecentSearch[]
  source: 'account' | 'demonstration'
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export type SearchHistoryService = {
  available: boolean
  load: (options: { signal: AbortSignal } & HistoryFilters) => Promise<SearchHistorySnapshot>
  get: (id: string, options: { signal: AbortSignal }) => Promise<SavedSearch>
  remove: (id: string, options: { signal: AbortSignal }) => Promise<void>
}

export const searchHistoryService: SearchHistoryService = {
  available: true,
  async load({ signal, ...filters }) {
    const query = new URLSearchParams()
    Object.entries(filters).forEach(([key, value]) => { if (value !== undefined && value !== '') query.set(key, String(value)) })
    return apiRequest<SearchHistorySnapshot>(`/history?${query}`, { signal })
  },
  get: (id, { signal }) => apiRequest<SavedSearch>(`/history/${encodeURIComponent(id)}`, { signal }),
  remove: (id, { signal }) => apiRequest<void>(`/history/${encodeURIComponent(id)}`, { method: 'DELETE', signal }),
}

export const historyName = (record: RecentSearch) => record.company?.name || record.originalQuery || 'Company search'
export function historyStatus(record: RecentSearch) {
  if (record.status === 'pending') return 'In progress'
  if (record.outcome === 'no_matches') return 'No match'
  if (record.outcome === 'provider_unavailable') return 'Provider unavailable'
  if (record.outcome === 'provider_error') return 'Provider error'
  return record.status === 'completed' ? 'Completed' : 'Failed'
}
