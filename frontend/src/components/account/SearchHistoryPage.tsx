import { useRef, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { CompanyMark } from '../dashboard/CompanyMark'
import { SearchIcon } from '../discovery/DiscoveryArtwork'
import { safeWebUrl } from '../../services/discovery'
import { historyName, historyStatus, searchHistoryService, type HistoryFilters, type SearchHistoryService } from '../../services/history'
import { useSearchHistory } from '../../services/useSearchHistory'
import { AccountPageLayout, type AccountPageProps } from './AccountPageLayout'
import { DeleteSearchButton } from './DeleteSearchButton'
import { useSectionReveal } from '../dashboard/useSectionReveal'
import { WordReveal } from '../motion/WordReveal'

export function SearchHistoryContent({ service = searchHistoryService }: { service?: SearchHistoryService }) {
  const [filters, setFilters] = useState<HistoryFilters>({ q: '', status: 'all', sort: 'recent', page: 1, pageSize: 20 })
  const [feedback, setFeedback] = useState('')
  const queryRef = useRef<HTMLInputElement>(null)
  const feedbackRef = useRef<HTMLParagraphElement>(null)
  const { state, reload } = useSearchHistory(filters, service)
  const snapshot = state.kind === 'ready' ? state.snapshot : null
  const records = snapshot?.records ?? []
  const hasFilters = !!filters.q || filters.status !== 'all'
  const updateFilters = (next: HistoryFilters) => { setFilters(current => ({ ...current, ...next, page: 1 })); setFeedback('') }
  const resetFilters = () => { updateFilters({ q: '', status: 'all' }); queryRef.current?.focus() }
  const page = filters.page ?? 1

  return <>
    <p ref={feedbackRef} tabIndex={-1} className={feedback ? 'account-notice' : 'sr-only'} role="status">{feedback}</p>
    {snapshot?.source === 'demonstration' && <p className="account-notice">Demonstration history — these records are examples, not your account’s searches.</p>}
    <section className="history-workspace" aria-label="Search history" data-reveal="surface">
      <div className="history-toolbar">
        <div className="history-query"><label htmlFor="history-query" className="sr-only">Filter discovery history</label><SearchIcon /><input id="history-query" ref={queryRef} value={filters.q} maxLength={160} onChange={event => updateFilters({ q: event.target.value })} placeholder="Company or person" autoComplete="off" />{filters.q && <button type="button" className="history-clear" aria-label="Clear history search" onClick={() => { updateFilters({ q: '' }); queryRef.current?.focus() }}>×</button>}</div>
        <div className="history-select"><label htmlFor="history-status">Status</label><select id="history-status" value={filters.status} onChange={event => updateFilters({ status: event.target.value as HistoryFilters['status'] })}><option value="all">All searches</option><option value="completed">Completed</option><option value="pending">In progress</option><option value="failed">Failed</option></select></div>
        <div className="history-select"><label htmlFor="history-sort">Sort by</label><select id="history-sort" value={filters.sort} onChange={event => updateFilters({ sort: event.target.value as HistoryFilters['sort'] })}><option value="recent">Most recent</option><option value="oldest">Oldest first</option></select></div>
      </div>
      <div aria-busy={state.kind === 'loading'}>
        {state.kind === 'loading' ? <div className="history-loading" role="status"><span className="discovery-spinner" aria-hidden="true" /><p>Loading your discovery history…</p><div aria-hidden="true"><span /><span /><span /></div></div>
          : state.kind === 'error' ? <div className="history-empty history-error" role="alert"><p className="presentation-eyebrow">A pause in your journey</p><h2>We couldn’t load your history.</h2><p>{state.message}</p><button className="button button--secondary" type="button" onClick={reload}>Try again</button></div>
          : <>
            {snapshot && <div className="history-result-count"><p role="status" aria-live="polite">{records.length ? `${(page - 1) * snapshot.pageSize + 1}–${(page - 1) * snapshot.pageSize + records.length} of ` : ''}{snapshot.total} {snapshot.total === 1 ? 'search' : 'searches'}{hasFilters ? ' matching your filters' : ''}</p>{hasFilters && <button type="button" className="presentation-inline-action" onClick={resetFilters}>Reset filters <span aria-hidden="true">↺</span></button>}</div>}
            {records.length ? <ol className="history-records" aria-label="Previously searched companies">
              {records.map((record, index) => {
                const date = record.searchedAt && Number.isFinite(Date.parse(record.searchedAt)) ? new Date(record.searchedAt) : null
                const name = historyName(record)
                return <li className="history-record" key={record.id} data-reveal="row" style={{ '--record-delay': `${Math.min(index, 5) * 45}ms` } as CSSProperties}>
                  <CompanyMark name={name} logoUrl={safeWebUrl(record.company?.logoUrl)} />
                  <div className="history-company"><h2>{name}</h2><p>{record.target ? <>{record.target.name}{record.target.title && <span> · {record.target.title}</span>}</> : record.candidateCount ? `${record.candidateCount} people candidates saved` : 'No person information saved'}</p></div>
                  <div className="history-record-meta">{date ? <time dateTime={date.toISOString()} title={date.toLocaleString()}>{date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</time> : <span>Date unavailable</span>}<span className={`search-state search-state--${record.status}`}>{historyStatus(record)}</span></div>
                  <div className="history-record-actions">
                    <Link className="history-reopen" to={`/history/${encodeURIComponent(record.id)}`} aria-label={`Open saved search for ${name}`}>Open <span aria-hidden="true">↗</span></Link>
                    <DeleteSearchButton record={record} service={service} onDeleted={() => {
                      setFeedback(`Saved search for ${name} deleted.`)
                      feedbackRef.current?.focus()
                      if (records.length === 1 && page > 1) setFilters(current => ({ ...current, page: page - 1 }))
                      else reload()
                    }} />
                  </div>
                </li>
              })}
            </ol> : <div className="history-empty">
              <div className="history-empty-art" aria-hidden="true"><span /><span /><span /><i>↗</i></div>
              <p className="presentation-eyebrow">{hasFilters ? 'A little more curiosity' : 'Your story starts here'}</p>
              <h2>{!snapshot ? 'Your history is still to come.' : hasFilters ? 'No matching discoveries.' : snapshot.total ? 'No searches on this page.' : 'Every discovery has a beginning.'}</h2>
              <p>{!snapshot ? 'Search history is not available yet.' : hasFilters ? 'Try a different company or person, or reset your filters to see all your searches.' : snapshot.total ? 'Return to a previous page to see your saved searches.' : 'You haven’t searched for a company yet. Start with a name and see where it takes you.'}</p>
              {hasFilters ? <button className="button button--secondary" type="button" onClick={resetFilters}>Reset filters</button> : !snapshot?.total && <Link className="button button--primary" to="/find-introductions">Explore companies <span aria-hidden="true">↗</span></Link>}
            </div>}
            {snapshot && (snapshot.totalPages > 1 || page > 1) && <nav className="history-pagination" aria-label="History pages">
              <button className="button button--secondary" type="button" disabled={page <= 1} onClick={() => setFilters(current => ({ ...current, page: page - 1 }))}>Previous</button>
              <span>Page {page} of {Math.max(1, snapshot.totalPages)}</span>
              <button className="button button--secondary" type="button" disabled={page >= snapshot.totalPages} onClick={() => setFilters(current => ({ ...current, page: page + 1 }))}>Next</button>
            </nav>}
          </>}
      </div>
    </section>
    <div className="history-footnote"><span aria-hidden="true">↗</span><p>Good connections are worth coming back to.</p><span>Opening a record restores its saved result.</span></div>
  </>
}

export function SearchHistoryPage({ service = searchHistoryService, ...props }: AccountPageProps & { service?: SearchHistoryService }) {
  const revealRef = useSectionReveal()
  return <AccountPageLayout {...props} title="Search history">
    <main className="account-main" id="account-page-content" tabIndex={-1} ref={revealRef}>
      <header className="account-hero history-hero" data-reveal="hero"><div><p className="presentation-eyebrow"><span /> Your journey, revisited</p><h1 data-motion-text="words"><WordReveal text="Your Discovery" /><br /><span><WordReveal text="History" start={2} /></span></h1><p>A place for the companies that caught your eye, the people behind them, and the possibilities worth another look.</p></div><div className="history-hero-note" aria-hidden="true"><span>↗</span><p>Follow your curiosity.<br />Find your way back.</p></div></header>
      <SearchHistoryContent key={props.user.id} service={service} />
    </main>
  </AccountPageLayout>
}
