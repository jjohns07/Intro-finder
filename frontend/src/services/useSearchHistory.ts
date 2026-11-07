import { useEffect, useState } from 'react'
import { searchHistoryService, type HistoryFilters, type SearchHistoryService, type SearchHistorySnapshot } from './history'

type HistoryState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; snapshot: SearchHistorySnapshot | null }

export function useSearchHistory(filters: HistoryFilters = {}, service: SearchHistoryService = searchHistoryService) {
  const [attempt, setAttempt] = useState(0)
  const key = JSON.stringify([filters.q ?? '', filters.status ?? 'all', filters.sort ?? 'recent', filters.page ?? 1, filters.pageSize ?? 20, attempt])
  const [response, setResponse] = useState<{ key: string; service: SearchHistoryService; state: HistoryState } | null>(null)

  useEffect(() => {
    if (!service.available) return
    const controller = new AbortController()
    const [q, status, sort, page, pageSize] = JSON.parse(key)
    service.load({ q, status, sort, page, pageSize, signal: controller.signal }).then(snapshot => {
      if (!controller.signal.aborted) setResponse({ key, service, state: { kind: 'ready', snapshot } })
    }).catch(error => {
      if (!controller.signal.aborted) setResponse({ key, service, state: {
        kind: 'error', message: error instanceof Error ? error.message : 'Your history could not be loaded. Please try again.',
      } })
    })
    return () => controller.abort()
  }, [key, service])

  const state: HistoryState = !service.available ? { kind: 'ready', snapshot: null }
    : response?.key === key && response.service === service ? response.state : { kind: 'loading' }
  return { state, reload: () => setAttempt(value => value + 1) }
}
