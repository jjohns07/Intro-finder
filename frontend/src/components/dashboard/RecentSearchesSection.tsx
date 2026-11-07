import { CompanyMark } from './CompanyMark'
import { Link } from 'react-router-dom'
import { historyName, historyStatus } from '../../services/history'
import { useSearchHistory } from '../../services/useSearchHistory'
import { safeWebUrl } from '../../services/discovery'

function SearchDate({ value }: { value?: string }) {
  if (!value || !Number.isFinite(Date.parse(value))) return <span>Date unavailable</span>
  return <time dateTime={value} title={new Date(value).toLocaleString()}>{new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</time>
}

export function RecentSearchesSection({ onSearch }: {
  onSearch: () => void
}) {
  const { state, reload } = useSearchHistory({ pageSize: 5 })
  const searches = state.kind === 'ready' ? state.snapshot?.records : null
  return <section className="presentation-activity recent-searches-section" id="activity" aria-labelledby="activity-heading" tabIndex={-1} data-reveal>
    <div className="presentation-activity-heading">
      <div><p className="presentation-eyebrow">05 / Recent searches</p><h2 id="activity-heading">Follow your curiosity.</h2></div>
      <p>A record of the companies, people, and possibilities you have explored.<Link className="presentation-inline-action history-section-link" to="/history">View discovery history <span aria-hidden="true">↗</span></Link></p>
    </div>
    {state.kind === 'loading' ? <div className="history-loading" role="status"><span className="discovery-spinner" aria-hidden="true" /><p>Loading recent searches…</p></div>
      : state.kind === 'error' ? <div className="recent-search-empty" role="alert"><div><h3>We couldn’t load your recent searches.</h3><p>{state.message}</p></div><button type="button" className="presentation-inline-action" onClick={reload}>Try again</button></div>
      : searches?.length ? <ol className="recent-search-feed" aria-label="Recent company searches">
      {searches.map((search, index) => <li key={search.id} data-reveal="row" style={{ '--item-delay': `${Math.min(index, 5) * 65}ms` } as React.CSSProperties}>
        <CompanyMark name={historyName(search)} logoUrl={safeWebUrl(search.company?.logoUrl)} />
        <div className="search-feed-company"><h3>{historyName(search)}</h3><p>{search.target ? <>{search.target.name}{search.target.title && <span> · {search.target.title}</span>}</> : 'No person information saved'}</p></div>
        <div className="search-feed-meta"><SearchDate value={search.searchedAt} /><span className={`search-state search-state--${search.status}`}>{historyStatus(search)}</span></div>
        <Link className="presentation-inline-action" to={`/history/${encodeURIComponent(search.id)}`} aria-label={`Open saved search for ${historyName(search)}`}>Open <span aria-hidden="true">↗</span></Link>
      </li>)}
    </ol> : <div className="recent-search-empty">
      <div className="search-feed-motif" aria-hidden="true"><span>01</span><i /><span>02</span><i /><span>03</span></div>
      <div><h3>Your next search starts the story.</h3><p>{searches == null ? 'Search history is not available yet. Your company searches will appear here once discovery is connected.' : 'No searches yet. Start with a company you would love to know better.'}</p></div>
      <button className="presentation-inline-action" type="button" onClick={onSearch}>Start a company search <span aria-hidden="true">↗</span></button>
    </div>}
  </section>
}
