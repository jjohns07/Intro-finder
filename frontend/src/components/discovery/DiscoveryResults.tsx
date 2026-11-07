import { useId, useState, type CSSProperties } from 'react'
import { CompanyMark } from '../dashboard/CompanyMark'
import { useSectionReveal } from '../dashboard/useSectionReveal'
import { isDemonstration, safeWebUrl, type DiscoveryConnection, type DiscoveryPath, type DiscoveryPerson, type DiscoveryResult } from '../../services/discovery'

function PersonPortrait({ person }: { person: DiscoveryPerson }) {
  const [failedUrl, setFailedUrl] = useState<string>()
  const imageUrl = safeWebUrl(person.imageUrl)
  const initials = person.name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase()
  return <span className="discovery-portrait" aria-hidden="true">
    {imageUrl && imageUrl !== failedUrl
      ? <img src={imageUrl} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailedUrl(imageUrl)} />
      : initials || '·'}
  </span>
}

const relationshipLabels: Record<DiscoveryConnection['relationship'], string> = {
  direct: 'Direct connection', warm: 'Warm connection', introduced: 'Introduced', vouched: 'Vouched connection', unknown: 'Relationship not provided',
}

function PathPanel({ path, people, connections, index }: {
  path: DiscoveryPath; people: DiscoveryPerson[]; connections: readonly DiscoveryConnection[]; index: number
}) {
  const detailsId = useId()
  const [expanded, setExpanded] = useState(false)
  const target = people.at(-1)!
  const strength = path.calculatedStrength
  const hasStrength = strength && Number.isFinite(strength.score) && strength.score >= 0 && strength.score <= 1 && strength.explanation.trim()
  const edges = people.slice(0, -1).map((person, i) => connections.find(connection =>
    connection.fromPersonId === person.id && connection.toPersonId === people[i + 1].id))
  return (
    <article className="discovery-path" data-reveal="path" style={{ '--path-delay': `${Math.min(index, 4) * 70}ms` } as CSSProperties} aria-labelledby={`${detailsId}-heading`}>
      <header className="discovery-path-heading">
        <div><p className="presentation-eyebrow">Path {String(index + 1).padStart(2, '0')}</p><h3 id={`${detailsId}-heading`}>A way to {target.name}</h3></div>
        <span className="discovery-depth">{people.length - 1} {people.length === 2 ? 'step' : 'steps'}</span>
      </header>
      <ol className="discovery-person-path" data-long={people.length > 4 || undefined} aria-label={`Introduction path to ${target.name}`}>
        {people.map((person, i) => <li key={`${person.id}-${i}`} style={{ '--node-index': Math.min(i, 6) } as CSSProperties}>
          <div className="discovery-person" data-position={i === 0 ? 'start' : i === people.length - 1 ? 'target' : 'bridge'}>
            <span className="discovery-person-label">{person.isCurrentUser ? 'You' : i === people.length - 1 ? 'Target' : i === 0 ? 'Starting point' : 'Connection'}</span>
            <PersonPortrait person={person} />
            <strong>{person.name}</strong>
            {(person.title || person.role) && <p>{person.title || person.role}</p>}
          </div>
          {i < people.length - 1 && <div className="discovery-edge">
            <svg viewBox="0 0 100 10" preserveAspectRatio="none" aria-hidden="true"><path d="M0 5h98m-5-4 5 4-5 4" pathLength="1" /></svg>
            <span>{edges[i] ? relationshipLabels[edges[i].relationship] : 'Relationship not provided'}</span>
          </div>}
        </li>)}
      </ol>
      <footer className="discovery-path-footer">
        <span>{hasStrength ? `Calculated path strength · ${Math.round(strength.score * 100)}%` : 'Path strength not available'}</span>
        <button className="presentation-inline-action" type="button" aria-expanded={expanded} aria-controls={detailsId} onClick={() => setExpanded(!expanded)}>{expanded ? 'Close path details' : 'Explore this path'}<span aria-hidden="true">{expanded ? '−' : '+'}</span></button>
      </footer>
      <div id={detailsId} hidden={!expanded} className="discovery-path-details">
        {path.explanation && <p>{path.explanation}</p>}
        {hasStrength && <p><strong>How strength was calculated</strong>{strength.explanation}</p>}
        <ol>
          {people.slice(0, -1).map((person, i) => <li key={`${person.id}-${i}`}>
            <strong>{person.name} <span aria-hidden="true">→</span> {people[i + 1].name}</strong>
            <p>{edges[i] ? relationshipLabels[edges[i].relationship] : 'Relationship not provided'}{edges[i]?.notes ? `. ${edges[i].notes}` : ''}</p>
          </li>)}
        </ol>
        <div className="discovery-profile-links">{people.map(person => {
          const url = safeWebUrl(person.profileUrl)
          return url ? <a key={person.id} href={url} target="_blank" rel="noopener noreferrer">View {person.name}’s profile <span aria-hidden="true">↗</span><span className="sr-only"> (opens in a new tab)</span></a> : null
        })}</div>
        <p className="discovery-source-note">{path.source === 'local-fixture' || path.isFixture ? 'Demonstration path — not a real introduction.' : path.source === 'approved-source' ? 'Path supplied by an approved data source.' : 'Path source is unavailable.'} An introduction still requires the people involved to agree.</p>
      </div>
    </article>
  )
}

export function DiscoveryResults({ result, onNewSearch }: { result: DiscoveryResult; onNewSearch: () => void }) {
  const revealRef = useSectionReveal()
  const { company } = result
  const website = safeWebUrl(company.website)
  const peopleById = new Map(result.people.filter(person => person.name.trim()).map(person => [person.id, person]))
  if (result.targetPerson?.name.trim()) peopleById.set(result.targetPerson.id, result.targetPerson)
  const resolvedPaths = (result.paths ?? []).flatMap(path => {
    if (path.path.length < 2 || path.path[0] !== path.startPersonId || path.path.at(-1) !== path.targetPersonId || new Set(path.path).size !== path.path.length) return []
    const people = path.path.map(id => peopleById.get(id))
    return people.every((person): person is DiscoveryPerson => !!person) ? [{ path, people }] : []
  })
  const incompleteCount = (result.paths?.length ?? 0) - resolvedPaths.length
  const targets = [...new Map([
    ...(result.targetPerson ? [result.targetPerson] : []),
    ...resolvedPaths.map(({ people }) => people.at(-1)!),
  ].map(person => [person.id, person])).values()]
  const demonstration = isDemonstration(result)
  const date = result.generatedAt ? new Date(result.generatedAt) : null
  return (
    <section className="discovery-results" aria-label="Company search results" ref={revealRef}>
      {demonstration && <p className="discovery-demo-notice">Demonstration data — these companies, people and paths are not verified search results or your real connections.</p>}
      {!!result.warnings?.length && <div className="discovery-result-warnings"><strong>Source notes</strong><ul>{result.warnings.map((warning, i) => <li key={i}>{warning}</li>)}</ul></div>}
      <article className="discovery-company" data-reveal aria-labelledby="discovery-company-heading">
        <div className="discovery-company-top"><p className="presentation-eyebrow">Company match</p><span>{demonstration ? 'Demonstration' : result.source === 'approved-source' ? 'Approved data source' : 'Source unavailable'}</span></div>
        <div className="discovery-company-grid">
          <div className="discovery-company-summary">
            <div className="discovery-company-identity"><CompanyMark name={company.name} logoUrl={safeWebUrl(company.logoUrl)} /><div>{company.industry && <p className="discovery-industry">{company.industry}</p>}<h2 id="discovery-company-heading">{company.name}</h2></div></div>
            <p className="discovery-company-description">{company.description || 'A company description was not provided by the data source.'}</p>
            {website && <a className="presentation-inline-action" href={website} target="_blank" rel="noopener noreferrer">{new URL(website).hostname.replace(/^www\./, '')}<span aria-hidden="true">↗</span><span className="sr-only"> (opens in a new tab)</span></a>}
          </div>
          <div className="discovery-decision-makers"><p className="presentation-eyebrow">People to know</p>{targets.length ? targets.map(person => <div className="discovery-target" key={person.id}>
            <PersonPortrait person={person} /><div><h3>{person.name}</h3>{(person.title || person.role) && <p>{person.title || person.role}</p>}{safeWebUrl(person.profileUrl) && <a href={safeWebUrl(person.profileUrl)} target="_blank" rel="noopener noreferrer">View profile ↗<span className="sr-only"> (opens in a new tab)</span></a>}</div>
          </div>) : <p>Founders and decision-makers were not included in this result.</p>}</div>
        </div>
        {date && Number.isFinite(date.getTime()) && <p className="discovery-source-note">Result generated <time dateTime={date.toISOString()}>{new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date)}</time></p>}
      </article>
      <div className="discovery-paths-heading" data-reveal="editorial"><div><p className="presentation-eyebrow">The people between you</p><h2>Your introduction paths<span>.</span></h2></div>{resolvedPaths.length > 0 && <p>{resolvedPaths.length} {resolvedPaths.length === 1 ? 'available path' : 'available paths'}<span>Connection depth follows the supplied path.</span></p>}</div>
      {incompleteCount > 0 && <p className="discovery-result-warnings">{incompleteCount} {incompleteCount === 1 ? 'path is' : 'paths are'} missing complete person details. Only complete paths can be displayed.</p>}
      {resolvedPaths.length ? <div className="discovery-path-list">{resolvedPaths.map(({ path, people }, index) => <PathPanel key={path.id} path={path} people={people} connections={result.connections ?? []} index={index} />)}</div> : <div className="discovery-no-paths">
        <span className="discovery-state-symbol" aria-hidden="true">↗</span>
        <h3>{result.paths === null || incompleteCount ? 'Introduction paths are not available yet.' : 'No introduction path found.'}</h3>
        <p>{result.paths === null ? 'This source has company information, but has not supplied connection paths.' : incompleteCount ? 'The source needs to provide the people along each path before you can explore it.' : `We found ${company.name}, but no path was returned in the available network data. Try another company to continue exploring.`}</p>
        <button type="button" className="presentation-inline-action" onClick={onNewSearch}>Search another company <span aria-hidden="true">↗</span></button>
      </div>}
    </section>
  )
}
