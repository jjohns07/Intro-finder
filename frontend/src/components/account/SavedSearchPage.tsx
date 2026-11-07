import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ApiError } from '../../services/api'
import { historyName, historyStatus, searchHistoryService, type SavedSearch } from '../../services/history'
import { AccountPageLayout, type AccountPageProps } from './AccountPageLayout'
import { DeleteSearchButton } from './DeleteSearchButton'
import { DiscoveryMatches } from '../discovery/DiscoveryResults'
import { useSectionReveal } from '../dashboard/useSectionReveal'

type DetailState = { kind: 'ready'; record: SavedSearch } | { kind: 'error'; message: string; missing: boolean }

export function SavedSearchPage(props: AccountPageProps) {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const revealRef = useSectionReveal()
  const [attempt, setAttempt] = useState(0)
  const [response, setResponse] = useState<{ id: string; attempt: number; state: DetailState } | null>(null)
  const state = response?.id === id && response.attempt === attempt ? response.state : null
  const record = state?.kind === 'ready' ? state.record : null

  useEffect(() => {
    const controller = new AbortController()
    searchHistoryService.get(id, { signal: controller.signal }).then(record => {
      if (!controller.signal.aborted) setResponse({ id, attempt, state: { kind: 'ready', record } })
    }).catch(error => {
      if (!controller.signal.aborted) setResponse({ id, attempt, state: {
        kind: 'error', missing: error instanceof ApiError && error.status === 404,
        message: error instanceof Error ? error.message : 'The saved search could not be loaded.',
      } })
    })
    return () => controller.abort()
  }, [id, attempt])

  return <AccountPageLayout {...props} title="Saved search">
    <main className="account-main saved-search-main" id="account-page-content" tabIndex={-1} ref={revealRef}>
      <header className="account-hero" data-reveal="hero"><div><p className="presentation-eyebrow"><span /> From your history</p><h1>{record ? historyName(record) : 'Saved search'}</h1><p>Your original search and the information saved with it.</p></div></header>
      <Link className="presentation-inline-action" to="/history">← Back to search history</Link>
      {!state ? <div className="history-loading" role="status"><span className="discovery-spinner" aria-hidden="true" /><p>Loading your saved search…</p></div>
        : state.kind === 'error' ? <section className="history-empty history-error" role="alert"><h2>{state.missing ? 'Saved search not found.' : 'We couldn’t open this search.'}</h2><p>{state.missing ? 'This search may have been deleted or may not belong to your account.' : state.message}</p>{!state.missing && <button type="button" className="button button--secondary" onClick={() => setAttempt(value => value + 1)}>Try again</button>}</section>
        : <>
          <section className="saved-search-summary" aria-label="Saved search details">
            <dl>
              <div><dt>Original query</dt><dd>{state.record.originalQuery}</dd></div>
              <div><dt>Searched</dt><dd><SavedDate value={state.record.searchedAt} /></dd></div>
              <div><dt>Last updated</dt><dd><SavedDate value={state.record.updatedAt} /></dd></div>
              <div><dt>Outcome</dt><dd><span className={`search-state search-state--${state.record.status}`}>{historyStatus(state.record)}</span></dd></div>
              <div><dt>Source</dt><dd>{state.record.provenance.source === 'disabled' ? 'No discovery provider connected' : state.record.provenance.provider}</dd></div>
            </dl>
            <div className="saved-search-actions">
              <Link className="button button--primary" to={`/find-introductions?company=${encodeURIComponent(state.record.originalQuery)}`}>Search again <span aria-hidden="true">↗</span></Link>
              {state.record.status === 'pending' && <button type="button" className="button button--secondary" onClick={() => setAttempt(value => value + 1)}>Refresh status</button>}
              <DeleteSearchButton record={state.record} onDeleted={() => navigate('/history', { replace: true })} />
            </div>
            <p>Search again creates a new search. This saved result stays unchanged.</p>
          </section>
          {state.record.matches?.length || state.record.result ? <DiscoveryMatches matches={state.record.matches?.length ? state.record.matches : [state.record.result!]} total={state.record.totalMatches || 1} matchMode={state.record.matchMode} onNewSearch={() => navigate('/find-introductions')} />
            : <section className="history-empty" aria-labelledby="saved-outcome-heading"><p className="presentation-eyebrow">{historyStatus(state.record)}</p><h2 id="saved-outcome-heading">{state.record.status === 'pending' ? 'This search is still in progress.' : state.record.outcome === 'no_matches' ? 'No company matched this search.' : state.record.outcome === 'provider_unavailable' ? 'Discovery was not connected.' : 'No result was saved.'}</h2><p>{state.record.message || 'No company, founder or introduction information was saved with this search.'}</p></section>}
        </>}
    </main>
  </AccountPageLayout>
}

function SavedDate({ value }: { value?: string }) {
  if (!value || !Number.isFinite(Date.parse(value))) return <>Date unavailable</>
  return <time dateTime={value}>{new Date(value).toLocaleString()}</time>
}
