import { CompanyMark } from './CompanyMark'
import type { RecentSearch } from './data'
import { Link } from 'react-router-dom'

const statusLabels = { completed: 'Completed', pending: 'In progress', failed: 'Failed' }

function SearchDate({ value }: { value?: string }) {
  if (!value || !Number.isFinite(Date.parse(value))) return <span>Date unavailable</span>
  return <time dateTime={value} title={new Date(value).toLocaleString()}>{new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</time>
}

export function RecentSearchesSection({ searches = null, onRevisit, onSearch }: {
  searches?: readonly RecentSearch[] | null
  onRevisit: (search: RecentSearch) => void
  onSearch: () => void
}) {
  return <section className="presentation-activity recent-searches-section" id="activity" aria-labelledby="activity-heading" tabIndex={-1} data-reveal>
    <div className="presentation-activity-heading">
      <div><p className="presentation-eyebrow">05 / Recent searches</p><h2 id="activity-heading">Follow your curiosity.</h2></div>
      <p>A record of the companies, people, and possibilities you have explored.<Link className="presentation-inline-action history-section-link" to="/history">View discovery history <span aria-hidden="true">↗</span></Link></p>
    </div>
    {searches?.length ? <ol className="recent-search-feed" aria-label="Recent company searches">
      {searches.map((search, index) => <li key={search.id} data-reveal="row" style={{ '--item-delay': `${Math.min(index, 5) * 65}ms` } as React.CSSProperties}>
        <CompanyMark {...search.company} />
        <div className="search-feed-company"><h3>{search.company.name}</h3><p>{search.target ? <>{search.target.name}{search.target.title && <span> · {search.target.title}</span>}</> : 'Target person not available'}</p></div>
        <div className="search-feed-meta"><SearchDate value={search.searchedAt} /><span className={`search-state search-state--${search.status}`}>{statusLabels[search.status]}</span></div>
        <button type="button" className="presentation-inline-action" onClick={() => onRevisit(search)} aria-label={`Revisit search for ${search.company.name}`}>Revisit <span aria-hidden="true">↗</span></button>
      </li>)}
    </ol> : <div className="recent-search-empty">
      <div className="search-feed-motif" aria-hidden="true"><span>01</span><i /><span>02</span><i /><span>03</span></div>
      <div><h3>Your next search starts the story.</h3><p>{searches == null ? 'Search history is not available yet. Your company searches will appear here once discovery is connected.' : 'No searches yet. Start with a company you would love to know better.'}</p></div>
      <button className="presentation-inline-action" type="button" onClick={onSearch}>Start a company search <span aria-hidden="true">↗</span></button>
    </div>}
  </section>
}
