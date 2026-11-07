import type { RecentSearch } from '../components/dashboard/data'

export type SearchHistorySnapshot = {
  records: readonly RecentSearch[]
  source: 'account' | 'demonstration'
}

export type SearchHistoryService = {
  available: boolean
  load: (options: { signal: AbortSignal }) => Promise<SearchHistorySnapshot | null>
}

// No search-history endpoint exists. Do not turn attempted/unavailable company
// searches into fake completed records or mix browser-local history with accounts.
export const searchHistoryService: SearchHistoryService = {
  available: false,
  async load({ signal }) {
    signal.throwIfAborted()
    return null
  },
}
