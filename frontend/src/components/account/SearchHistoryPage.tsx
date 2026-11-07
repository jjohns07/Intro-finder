import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { CompanyMark } from '../dashboard/CompanyMark'
import { SearchIcon } from '../discovery/DiscoveryArtwork'
import { safeWebUrl } from '../../services/discovery'
import { searchHistoryService, type SearchHistoryService, type SearchHistorySnapshot } from '../../services/history'
import { AccountPageLayout, type AccountPageProps } from './AccountPageLayout'

type HistoryState = { kind: 'loading' | 'error' } | { kind: 'ready'; snapshot: SearchHistorySnapshot | null }
const statusLabels = { completed: 'Completed', pending: 'In progress', failed: 'Failed' }
type StatusFilter = 'all' | keyof typeof statusLabels

export function SearchHistoryContent({ snapshot }: { snapshot: SearchHistorySnapshot | null }) {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [sort, setSort] = useState<'recent' | 'oldest'>('recent')
  const queryRef = useRef<HTMLInputElement>(null)
  const records = snapshot?.records ?? []
  const filtered = records.filter(record => {
    const text = [record.company.name, record.target?.name, record.target?.title].filter(Boolean).join(' ').toLocaleLowerCase()
    return text.includes(query.trim().toLocaleLowerCase()) && (status === 'all' || record.status === status)
  }).sort((a, b) => {
    const first = a.searchedAt ? Date.parse(a.searchedAt) : NaN
    const second = b.searchedAt ? Date.parse(b.searchedAt) : NaN
    // Unknown dates stay last for both directions; equal dates keep source order.
    if (!Number.isFinite(first)) return Number.isFinite(second) ? 1 : 0
    if (!Number.isFinite(second)) return -1
    return sort === 'recent' ? second - first : first - second
  })
  const hasFilters = !!query || status !== 'all'
  const resetFilters = () => { setQuery(''); setStatus('all'); queryRef.current?.focus() }

  return <>
    {snapshot?.source === 'demonstration' && <p className="account-notice">Demonstration history — these records are examples, not your account’s searches.</p>}
    <section className="history-workspace" aria-label="Search history">
      <div className="history-toolbar">
        <div className="history-query"><label htmlFor="history-query" className="sr-only">Filter discovery history</label><SearchIcon /><input id="history-query" ref={queryRef} value={query} disabled={!records.length} onChange={event => setQuery(event.target.value)} placeholder="Company or person" autoComplete="off" />{query && <button type="button" className="history-clear" aria-label="Clear history search" onClick={() => { setQuery(''); queryRef.current?.focus() }}>×</button>}</div>
        <div className="history-select"><label htmlFor="history-status">Status</label><select id="history-status" value={status} disabled={!records.length} onChange={event => setStatus(event.target.value as StatusFilter)}><option value="all">All searches</option><option value="completed">Completed</option><option value="pending">In progress</option><option value="failed">Failed</option></select></div>
        <div className="history-select"><label htmlFor="history-sort">Sort by</label><select id="history-sort" value={sort} disabled={!records.length} onChange={event => setSort(event.target.value as 'recent' | 'oldest')}><option value="recent">Most recent</option><option value="oldest">Oldest first</option></select></div>
      </div>
      {snapshot && records.length > 0 && <div className="history-result-count"><p role="status" aria-live="polite">{filtered.length} of {records.length} {records.length === 1 ? 'search' : 'searches'}{snapshot.source === 'demonstration' ? ' · Demonstration' : ''}</p>{hasFilters && <button type="button" className="presentation-inline-action" onClick={resetFilters}>Reset filters <span aria-hidden="true">↺</span></button>}</div>}
      {filtered.length > 0 ? <ol className="history-records" key={`${query}-${status}-${sort}`} aria-label="Previously searched companies">
        {filtered.map((record, index) => {
          const date = record.searchedAt && Number.isFinite(Date.parse(record.searchedAt)) ? new Date(record.searchedAt) : null
          return <li className="history-record" key={record.id} style={{ '--record-delay': `${Math.min(index, 5) * 45}ms` } as CSSProperties}>
            <CompanyMark name={record.company.name} logoUrl={safeWebUrl(record.company.logoUrl)} />
            <div className="history-company"><h2>{record.company.name}</h2><p>{record.target ? <>{record.target.name}{record.target.title && <span> · {record.target.title}</span>}</> : 'Target person not available'}</p></div>
            <div className="history-record-meta">{date ? <time dateTime={date.toISOString()} title={date.toLocaleString()}>{date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</time> : <span>Date unavailable</span>}<span className={`search-state search-state--${record.status}`}>{statusLabels[record.status]}</span></div>
            <Link className="history-reopen" to={`/find-introductions?company=${encodeURIComponent(record.company.name)}`} aria-label={`Reopen search for ${record.company.name}`}>Reopen <span aria-hidden="true">↗</span></Link>
          </li>
        })}
      </ol> : <div className="history-empty">
        <div className="history-empty-art" aria-hidden="true"><span /><span /><span /><i>↗</i></div>
        <p className="presentation-eyebrow">{!snapshot ? 'A space for your discoveries' : records.length ? 'A little more curiosity' : 'Your story starts here'}</p>
        <h2>{!snapshot ? 'Your history is still to come.' : records.length ? 'No matching discoveries.' : 'Every discovery has a beginning.'}</h2>
        <p>{!snapshot ? 'Search history is not available yet. Once it is connected, you’ll be able to return to the companies and people you’ve explored.' : records.length ? 'Try a different company or person, or reset your filters to see all your searches.' : 'You haven’t searched for a company yet. Start with a name and see where it takes you.'}</p>
        {records.length ? <button className="button button--secondary" type="button" onClick={resetFilters}>Reset filters</button> : <Link className="button button--primary" to="/find-introductions">Explore companies <span aria-hidden="true">↗</span></Link>}
      </div>}
    </section>
    <div className="history-footnote"><span aria-hidden="true">↗</span><p>Good connections are worth coming back to.</p>{!!records.length && <span>Reopening a record runs a new company search.</span>}</div>
  </>
}

export function SearchHistoryPage({ service = searchHistoryService, ...props }: AccountPageProps & { service?: SearchHistoryService }) {
  const [state, setState] = useState<HistoryState>(() => service.available ? { kind: 'loading' } : { kind: 'ready', snapshot: null })
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    if (!service.available) return
    const controller = new AbortController()
    const timeout = window.setTimeout(() => { controller.abort(); setState({ kind: 'error' }) }, 20_000)
    service.load({ signal: controller.signal }).then(snapshot => {
      if (!controller.signal.aborted) setState({ kind: 'ready', snapshot })
    }).catch(() => {
      if (!controller.signal.aborted) setState({ kind: 'error' })
    }).finally(() => window.clearTimeout(timeout))
    return () => { controller.abort(); window.clearTimeout(timeout) }
  }, [attempt, service])

  return <AccountPageLayout {...props} title="Search history">
    <main className="account-main" id="account-page-content" tabIndex={-1}>
      <header className="account-hero history-hero"><div><p className="presentation-eyebrow"><span /> Your journey, revisited</p><h1>Your Discovery<br /><span>History</span></h1><p>A place for the companies that caught your eye, the people behind them, and the possibilities worth another look.</p></div><div className="history-hero-note" aria-hidden="true"><span>↗</span><p>Follow your curiosity.<br />Find your way back.</p></div></header>
      {state.kind === 'ready' ? <SearchHistoryContent snapshot={state.snapshot} /> : state.kind === 'loading' ? <div className="history-loading" role="status"><span className="discovery-spinner" aria-hidden="true" /><p>Loading your discovery history…</p><div aria-hidden="true"><span /><span /><span /></div></div> : <div className="history-empty history-error" role="alert"><p className="presentation-eyebrow">A pause in your journey</p><h2>We couldn’t load your history.</h2><p>The history service did not respond. Please try again.</p><button className="button button--secondary" type="button" onClick={() => { setState({ kind: 'loading' }); setAttempt(current => current + 1) }}>Try again</button></div>}
    </main>
  </AccountPageLayout>
}
