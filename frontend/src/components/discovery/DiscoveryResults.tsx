import { useCallback, useId, useState, type CSSProperties } from 'react'
import { useSectionReveal } from '../dashboard/useSectionReveal'
import { isDemonstration, safeWebUrl, type DiscoveryCompanyDetails, type DiscoveryConnection, type DiscoveryPath, type DiscoveryPerson, type DiscoveryResult } from '../../services/discovery'
import { CompanyInformation, type CompanyInformationProps } from './CompanyInformation'

type CompanyLoadingProps = Pick<CompanyInformationProps, 'searchId' | 'loadDetails' | 'autoLoadDetails'>

export function DiscoveryMatches({ matches, total, matchMode, onNewSearch, ...companyLoading }: {
  matches: readonly DiscoveryResult[]; total: number; matchMode?: 'exact' | 'prefix' | 'relevance'; onNewSearch: () => void
} & CompanyLoadingProps) {
  const ambiguous = total > 1 || matchMode === 'prefix' || matchMode === 'relevance'
  const [selected, setSelected] = useState<string | null>(ambiguous ? null : matches[0]?.company.id ?? null)
  const [profiles, setProfiles] = useState(() => new Map<string, DiscoveryCompanyDetails>())
  const rememberDetails = useCallback((companyId: string, details: DiscoveryCompanyDetails) => {
    setProfiles(previous => new Map(previous).set(companyId, details))
  }, [])
  const active = matches.find(match => match.company.id === selected)
  return <>
    {ambiguous && <section className="discovery-match-picker" aria-labelledby="company-matches-heading">
      <p className="presentation-eyebrow">Possible company matches</p>
      <h2 id="company-matches-heading">Which company did you mean?</h2>
      <p>{matchMode === 'prefix' ? 'No exact name matched. These company names start with your search.' : matchMode === 'relevance' ? 'The provider returned possible matches for your company name.' : 'Several companies share this name.'} Choose a company to explore its overview, people and sources.</p>
      {total > matches.length && <p>Showing {matches.length} of {total} matches. Use a more specific company name to narrow your search.</p>}
      <div className="discovery-match-options">{matches.map(({ company }) => <button type="button" key={company.id} aria-pressed={selected === company.id} onClick={() => setSelected(company.id)}>
        <strong>{company.name}</strong>
        <span>{[company.industry, company.location, company.country && !company.location?.toLowerCase().includes(company.country.toLowerCase()) ? company.country : undefined].filter(Boolean).join(' · ') || 'Location and industry not supplied'}</span>
        <span>{safeWebUrl(company.website) ? new URL(safeWebUrl(company.website)!).hostname : 'Website not supplied'}</span>
        <small>{company.attribution?.provider || 'Provider result'} · {company.id}</small>
      </button>)}</div>
    </section>}
    {active && <DiscoveryResults key={active.company.id} result={profiles.has(active.company.id) ? { ...active, companyDetails: profiles.get(active.company.id) } : active} onNewSearch={onNewSearch} onDetailsChange={rememberDetails} {...companyLoading} />}
  </>
}

function CandidateEvidence({ person }: { person: DiscoveryPerson }) {
  if (!person.evidence?.length) return <p className="discovery-source-note">Supporting employment evidence was not supplied.</p>
  return <details className="discovery-evidence">
    <summary>Review source evidence</summary>
    {person.verification && <><p><strong>Provider-supported candidate</strong></p><p>{person.verification.explanation}</p><p>{person.verification.limitation}</p></>}
    <ul>{person.evidence.map((item, index) => <li key={`${item.field}-${index}`}>
      <strong>{item.title}</strong>
      <p>{item.affiliation === 'current' ? 'Current affiliation reported by provider' : item.affiliation === 'historical' ? 'Historical affiliation' : 'Current affiliation unknown'}{item.startDate ? ` · From ${item.startDate}` : ''}{item.endDate ? ` · Until ${item.endDate}` : ''}</p>
      <p>{item.provider} · Company ID: {item.companyId}</p>
      {item.lastSeen && <p>Last seen by provider: {item.lastSeen}</p>}
      {item.sourceCount !== undefined && <p>Provider reports {item.sourceCount} contributing {item.sourceCount === 1 ? 'source' : 'sources'} for this employment record.</p>}
    </li>)}</ul>
  </details>
}

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

export function DiscoveryResults({ result, onNewSearch, onDetailsChange, ...companyLoading }: {
  result: DiscoveryResult; onNewSearch: () => void; onDetailsChange?: CompanyInformationProps['onDetailsChange']
} & CompanyLoadingProps) {
  const revealRef = useSectionReveal()
  const { company } = result
  const peopleById = new Map(result.people.filter(person => person.name.trim()).map(person => [person.id, person]))
  if (result.targetPerson?.name.trim()) peopleById.set(result.targetPerson.id, result.targetPerson)
  const resolvedPaths = (result.paths ?? []).flatMap(path => {
    if (path.path.length < 2 || path.path[0] !== path.startPersonId || path.path.at(-1) !== path.targetPersonId || new Set(path.path).size !== path.path.length) return []
    const people = path.path.map(id => peopleById.get(id))
    return people.every((person): person is DiscoveryPerson => !!person) ? [{ path, people }] : []
  })
  const incompleteCount = (result.paths?.length ?? 0) - resolvedPaths.length
  const targets = [...new Map([
    ...result.people.filter(person => person.role === 'founder' || person.role === 'executive'),
    ...(result.targetPerson ? [result.targetPerson] : []),
    ...resolvedPaths.map(({ people }) => people.at(-1)!),
  ].map(person => [person.id, person])).values()]
  const demonstration = isDemonstration(result)
  return (
    <section className="discovery-results" aria-label="Company search results" ref={revealRef}>
      {demonstration && <p className="discovery-demo-notice">Demonstration data — these companies, people and paths are not verified search results or your real connections.</p>}
      <CompanyInformation company={company} initialDetails={result.companyDetails} onDetailsChange={onDetailsChange} {...companyLoading} />
      {!!result.warnings?.length && <div className="discovery-result-warnings"><strong>Source notes</strong><ul>{result.warnings.map((warning, i) => <li key={i}>{warning}</li>)}</ul></div>}
      <article className="discovery-people" aria-label="Founder and decision-maker candidates">
          <p className="presentation-eyebrow">Founder & decision-maker candidates</p><div className="discovery-candidates-grid">{targets.length ? targets.map(person => <div className="discovery-target" key={person.id}>
            <PersonPortrait person={person} /><div><h3>{person.name}</h3><p className="discovery-candidate-role">{person.role === 'founder' ? 'Founder candidate' : 'Decision-maker candidate'}</p>{(person.title || person.role) && <p>{person.title || person.role}</p>}{safeWebUrl(person.profileUrl) && <a href={safeWebUrl(person.profileUrl)} target="_blank" rel="noopener noreferrer">View provider-listed profile ↗<span className="sr-only"> (opens in a new tab)</span></a>}<CandidateEvidence person={person} /></div>
          </div>) : <p>{result.peopleStatus === 'not_configured' ? 'People discovery is not enabled. Company information is still available.' : result.peopleStatus === 'no_candidates' ? 'No founder or decision-maker candidates with matching employment evidence were found in the returned records.' : result.peopleStatus && result.peopleStatus !== 'available' ? 'People discovery could not complete. See the source notes above; company information is still available.' : 'Founders and decision-makers were not included in this result.'}</p>}</div>
      </article>
      <div className="discovery-paths-heading" data-reveal="editorial"><div><p className="presentation-eyebrow">The people between you</p><h2>Your introduction paths<span>.</span></h2></div>{resolvedPaths.length > 0 && <p>{resolvedPaths.length} {resolvedPaths.length === 1 ? 'available path' : 'available paths'}<span>Connection depth follows the supplied path.</span></p>}</div>
      {incompleteCount > 0 && <p className="discovery-result-warnings">{incompleteCount} {incompleteCount === 1 ? 'path is' : 'paths are'} missing complete person details. Only complete paths can be displayed.</p>}
      {resolvedPaths.length ? <div className="discovery-path-list">{resolvedPaths.map(({ path, people }, index) => <PathPanel key={path.id} path={path} people={people} connections={result.connections ?? []} index={index} />)}</div> : <div className="discovery-no-paths">
        <span className="discovery-state-symbol" aria-hidden="true">↗</span>
        <h3>{result.paths === null || incompleteCount ? 'Introduction paths are not available yet.' : 'No introduction path found.'}</h3>
        <p>{result.paths === null ? 'Company and people discovery is separate from connection discovery. No relationship source is connected, so we cannot establish a warm introduction. A social follow does not establish a trusted relationship.' : incompleteCount ? 'The source needs to provide the people along each path before you can explore it.' : `We found ${company.name}, but no path was returned in the available network data. Try another company to continue exploring.`}</p>
        <button type="button" className="presentation-inline-action" onClick={onNewSearch}>Search another company <span aria-hidden="true">↗</span></button>
      </div>}
    </section>
  )
}
