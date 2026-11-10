import { useCallback, useId, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { useSectionReveal } from '../dashboard/useSectionReveal'
import { isDemonstration, safeWebUrl, type DiscoveryCompanyDetails, type DiscoveryConnection, type DiscoveryPath, type DiscoveryPerson, type DiscoveryResult } from '../../services/discovery'
import { CompanyInformation, type CompanyInformationProps } from './CompanyInformation'
import { CandidateNetworkMatch } from './CandidateNetworkMatch'
import { networkService, type IntroductionReport, type IntroductionStatus } from '../../services/network'

type CompanyLoadingProps = Pick<CompanyInformationProps, 'searchId' | 'loadDetails' | 'autoLoadDetails'>

export function DiscoveryMatches({ matches, total, matchMode, onNewSearch, ...companyLoading }: {
  matches: readonly DiscoveryResult[]; total: number; matchMode?: 'exact' | 'prefix' | 'relevance'; onNewSearch: () => void
} & CompanyLoadingProps) {
  const ambiguous = total > 1 || matchMode === 'prefix' || matchMode === 'relevance'
  const [selected, setSelected] = useState<string | null>(ambiguous ? null : matches[0]?.company.id ?? null)
  const [profiles, setProfiles] = useState(() => new Map<string, DiscoveryCompanyDetails>())
  const [networks, setNetworks] = useState(() => new Map<string, DiscoveryResult>())
  const rememberDetails = useCallback((companyId: string, details: DiscoveryCompanyDetails) => {
    setProfiles(previous => new Map(previous).set(companyId, details))
  }, [])
  const rememberNetwork = useCallback((result: DiscoveryResult) => { setNetworks(previous => new Map(previous).set(result.company.id, result)) }, [])
  const found = matches.find(match => match.company.id === selected)
  const active = found ? networks.get(found.company.id) ?? found : undefined
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
    {active && <DiscoveryResults key={active.company.id} result={profiles.has(active.company.id) ? { ...active, companyDetails: profiles.get(active.company.id) } : active} onNewSearch={onNewSearch} onDetailsChange={rememberDetails} onNetworkResult={rememberNetwork} {...companyLoading} />}
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
  direct_connection: 'Direct connection · user-confirmed', user_confirmed: 'Personal relationship · user-confirmed', follows: 'Follows only', mutual_follow: 'Mutual follow only',
}

function SourceTime({ value }: { value?: string }) {
  return value && Number.isFinite(Date.parse(value)) ? <time dateTime={value} title="UTC date">{new Date(value).toLocaleDateString(undefined, { timeZone: 'UTC' })}</time> : <>Date unavailable</>
}

const pathReasons: Record<IntroductionStatus, string> = {
  available: 'Paths use evidenced relationships in your private network. An introduction still requires everyone involved to agree.',
  network_not_imported: 'No private network has been imported. Import your authorised connection CSV to begin. LinkedIn and X network integrations are unavailable.',
  candidate_not_identified: 'No founder or executive candidate was identified in the returned company records. Company information remains available.',
  candidate_provider_error: 'The provider could not retrieve founder or executive candidates, so there is no candidate to connect to yet.',
  identity_unresolved: 'Confirm which imported contact is this founder or executive. Matching names alone cannot establish an identity.',
  no_path: 'No eligible path was found to the confirmed candidate identities in your imported network. Follows, mutual follows, unverified records and evidence older than 365 days are excluded.',
  search_limited: 'No path was found within the bounded search. The search stops at four steps and may omit longer paths.',
  network_error: 'Your network could not be checked or changed during this request. Refresh paths to try again; your company and candidate information remains available.',
}

function CandidatePathStatus({ candidate }: { candidate?: IntroductionReport['candidates'][number] }) {
  if (!candidate) return null
  const messages = {
    available: 'An evidenced path is available below.',
    identity_unresolved: 'No identity match confirmed for this candidate yet.',
    no_path: 'No eligible path to this candidate in your imported network.',
    search_limited: 'No path to this candidate was found within the search limits.',
  }
  return <p>{messages[candidate.status]}{candidate.pathsLimited ? ' Additional shortest paths exist; only the first three are shown.' : ''}</p>
}

function eligibleEvidence(edge: DiscoveryConnection, checkedAt: number, maxAgeDays: number) {
  const evidence = edge.evidence
  if (!evidence || evidence.source !== 'csv' || evidence.verification !== 'user_confirmed'
    || evidence.statement.trim().length < 10 || evidence.statement.length > 500) return false
  const observed = Date.parse(evidence.observedAt)
  return [observed, Date.parse(evidence.importedAt), Date.parse(evidence.updatedAt)].every(Number.isFinite)
    && observed <= checkedAt && checkedAt - observed <= maxAgeDays * 86_400_000
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
    (!path.connectionIds || connection.id === path.connectionIds[i]) && connection.fromPersonId === person.id && connection.toPersonId === people[i + 1].id))
  return (
    <article className="discovery-path" data-reveal="path" style={{ '--path-delay': `${Math.min(index, 4) * 70}ms` } as CSSProperties} aria-labelledby={`${detailsId}-heading`}>
      <header className="discovery-path-heading">
        <div><p className="presentation-eyebrow">Path {String(index + 1).padStart(2, '0')}</p><h3 id={`${detailsId}-heading`}>A way to {target.name}</h3></div>
        <span className="discovery-depth">{people.length - 1} {people.length === 2 ? 'step' : 'steps'} · {people.length - 2} {people.length === 3 ? 'intermediary' : 'intermediaries'}</span>
      </header>
      <ol className="discovery-person-path" data-long={people.length > 4 || undefined} aria-label={`Introduction path to ${target.name}`}>
        {people.map((person, i) => <li key={`${person.id}-${i}`} style={{ '--node-index': Math.min(i, 6) } as CSSProperties}>
          <div className="discovery-person" data-position={i === 0 ? 'start' : i === people.length - 1 ? 'target' : 'bridge'}>
            <span className="discovery-person-label">{person.isCurrentUser ? 'You' : i === people.length - 1 ? 'Target' : i === 0 ? 'Starting point' : 'Connection'}</span>
            <PersonPortrait person={person} />
            <strong>{person.name}</strong>
            {(person.title || person.role) && <p>{person.title || person.role}</p>}
            <details className="path-person-details"><summary>Inspect {person.name}</summary>
              <p>{person.isCurrentUser ? 'Your authenticated account identity.' : person.source === 'user-import' ? 'Contact from your private CSV import.' : 'Candidate supplied by the company data provider.'}</p>
              {person.importedAt && <p>Imported: <SourceTime value={person.importedAt} /></p>}
              {person.updatedAt && <p>Updated: <SourceTime value={person.updatedAt} /></p>}
              {safeWebUrl(person.profileUrl) ? <a href={safeWebUrl(person.profileUrl)} target="_blank" rel="noopener noreferrer">View profile ↗</a> : <p>Profile link not provided.</p>}
            </details>
          </div>
          {i < people.length - 1 && <div className="discovery-edge">
            <svg viewBox="0 0 100 10" preserveAspectRatio="none" aria-hidden="true"><path d="M0 5h98m-5-4 5 4-5 4" pathLength="1" /></svg>
            <span>{edges[i] ? relationshipLabels[edges[i].relationship] : 'Relationship not provided'}</span>
          </div>}
        </li>)}
      </ol>
      <footer className="discovery-path-footer">
        <span>{path.source === 'user-import' ? <>Oldest relationship evidence · <SourceTime value={path.oldestEvidenceAt} /></> : hasStrength ? `Calculated path strength · ${Math.round(strength.score * 100)}%` : 'Path strength not available'}</span>
        <button className="presentation-inline-action" type="button" aria-expanded={expanded} aria-controls={detailsId} onClick={() => setExpanded(!expanded)}>{expanded ? 'Close path details' : 'Explore this path'}<span aria-hidden="true">{expanded ? '−' : '+'}</span></button>
      </footer>
      <div id={detailsId} hidden={!expanded} className="discovery-path-details">
        {path.explanation && <p>{path.explanation}</p>}
        {path.updatedAt && <p>Path relationships last updated: <SourceTime value={path.updatedAt} /></p>}
        {hasStrength && <p><strong>How strength was calculated</strong>{strength.explanation}</p>}
        <ol>
          {people.slice(0, -1).map((person, i) => <li key={`${person.id}-${i}`}>
            <strong>{person.name} <span aria-hidden="true">→</span> {people[i + 1].name}</strong>
            <p>{edges[i] ? relationshipLabels[edges[i].relationship] : 'Relationship not provided'}{edges[i]?.notes ? `. ${edges[i].notes}` : ''}</p>
            {edges[i]?.evidence && <div className="path-edge-evidence"><p>{edges[i]!.evidence!.statement}</p><p>Source: private CSV · Confirmed by you; not independently verified.</p>
              {edges[i]!.evidence!.recordNumber && <p>CSV record {edges[i]!.evidence!.recordNumber} (including the header).</p>}
              <p>Observed: <SourceTime value={edges[i]!.evidence!.observedAt} /> · Imported: <SourceTime value={edges[i]!.evidence!.importedAt} /> · Updated: <SourceTime value={edges[i]!.evidence!.updatedAt} /></p></div>}
          </li>)}
        </ol>
        <div className="discovery-profile-links">{people.map(person => {
          const url = safeWebUrl(person.profileUrl)
          return url ? <a key={person.id} href={url} target="_blank" rel="noopener noreferrer">View {person.name}’s profile <span aria-hidden="true">↗</span><span className="sr-only"> (opens in a new tab)</span></a> : null
        })}</div>
        <p className="discovery-source-note">{path.source === 'local-fixture' || path.isFixture ? 'Demonstration path — not a real introduction.' : path.source === 'user-import' ? 'Path calculated from your confirmed CSV relationships. Trust and willingness to introduce have not been independently verified.' : path.source === 'approved-source' ? 'Path supplied by an approved data source.' : 'Path source is unavailable.'} An introduction still requires the people involved to agree.</p>
      </div>
    </article>
  )
}

export function DiscoveryResults({ result: initialResult, onNewSearch, onDetailsChange, onNetworkResult, ...companyLoading }: {
  result: DiscoveryResult; onNewSearch: () => void; onDetailsChange?: CompanyInformationProps['onDetailsChange']; onNetworkResult?: (result: DiscoveryResult) => void
} & CompanyLoadingProps) {
  const revealRef = useSectionReveal()
  const [updatedNetwork, setUpdatedNetwork] = useState<DiscoveryResult>()
  const [refreshing, setRefreshing] = useState(false)
  const [networkError, setNetworkError] = useState('')
  const [fallbackCheckedAt] = useState(Date.now)
  const result = updatedNetwork ? { ...initialResult, people: updatedNetwork.people, paths: updatedNetwork.paths, connections: updatedNetwork.connections, introduction: updatedNetwork.introduction, connectionStatus: updatedNetwork.connectionStatus } : initialResult
  const remember = (next: DiscoveryResult) => { setUpdatedNetwork(next); onNetworkResult?.({ ...next, companyDetails: initialResult.companyDetails }) }
  const refresh = async () => {
    if (!companyLoading.searchId || refreshing) return
    setRefreshing(true); setNetworkError('')
    try { remember(await networkService.refreshPaths(companyLoading.searchId, result.company.id)) }
    catch (error) { setNetworkError(error instanceof Error ? error.message : 'Could not refresh introduction paths.') }
    finally { setRefreshing(false) }
  }
  const { company } = result
  const evidenceCheckedAt = result.introduction?.checkedAt ? Date.parse(result.introduction.checkedAt) : fallbackCheckedAt
  const peopleById = new Map(result.people.filter(person => person.name.trim()).map(person => [person.id, person]))
  if (result.targetPerson?.name.trim()) peopleById.set(result.targetPerson.id, result.targetPerson)
  const resolvedPaths = (result.paths ?? []).flatMap(path => {
    if (path.path.length < 2 || path.path[0] !== path.startPersonId || path.path.at(-1) !== path.targetPersonId || new Set(path.path).size !== path.path.length) return []
    if (path.source === 'user-import' && (result.introduction?.status !== 'available'
      || path.path.length - 1 > result.introduction.maxDepth
      || !peopleById.get(path.startPersonId)?.isCurrentUser || !result.introduction.candidates.some(candidate => candidate.candidateId === path.targetPersonId && candidate.status === 'available' && candidate.identity?.verification === 'user_confirmed')
      || path.connectionIds?.length !== path.path.length - 1 || path.path.slice(0, -1).some((id, index) => !result.connections?.some(edge =>
        edge.id === path.connectionIds![index] && edge.fromPersonId === id && edge.toPersonId === path.path[index + 1]
        && edge.source === 'user-import' && ['direct_connection', 'user_confirmed'].includes(edge.relationship)
        && eligibleEvidence(edge, evidenceCheckedAt, result.introduction?.maxEvidenceAgeDays ?? 365))))) return []
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
            <PersonPortrait person={person} /><div><h3>{person.name}</h3><p className="discovery-candidate-role">{person.role === 'founder' ? 'Founder candidate' : 'Decision-maker candidate'}</p>{(person.title || person.role) && <p>{person.title || person.role}</p>}{safeWebUrl(person.profileUrl) && <a href={safeWebUrl(person.profileUrl)} target="_blank" rel="noopener noreferrer">View provider-listed profile ↗<span className="sr-only"> (opens in a new tab)</span></a>}<CandidateEvidence person={person} />
              {companyLoading.searchId && result.introduction?.networkRevision !== undefined && <CandidateNetworkMatch person={person} companyId={company.id} searchId={companyLoading.searchId} revision={result.introduction.networkRevision} identity={result.introduction.candidates.find(candidate => candidate.candidateId === person.id)?.identity} onResult={remember} />}
              <CandidatePathStatus candidate={result.introduction?.candidates.find(candidate => candidate.candidateId === person.id)} />
            </div>
          </div>) : <p>{result.peopleStatus === 'not_configured' ? 'People discovery is not enabled. Company information is still available.' : result.peopleStatus === 'no_candidates' ? 'No founder or decision-maker candidates with matching employment evidence were found in the returned records.' : result.peopleStatus && result.peopleStatus !== 'available' ? 'People discovery could not complete. See the source notes above; company information is still available.' : 'Founders and decision-makers were not included in this result.'}</p>}</div>
      </article>
      <div className="discovery-paths-heading" data-reveal="editorial"><div><p className="presentation-eyebrow">The people between you</p><h2>Your introduction paths<span>.</span></h2></div>{resolvedPaths.length > 0 && <p>{resolvedPaths.length} {resolvedPaths.length === 1 ? 'available path' : 'available paths'}<span>Connection depth follows the supplied path.</span></p>}</div>
      {result.introduction && <div className="network-path-summary"><p>Private network only · Social integrations unavailable · Search limit: {result.introduction.maxDepth} steps, {result.introduction.maxPathsPerCandidate} shortest paths per candidate.</p>
        {result.introduction.networkStatus === 'not_imported' && <p>Network data has not been imported.</p>}
        {result.introduction.networkStatus === 'unavailable' && <p>Network availability could not be checked.</p>}
        {result.introduction.networkUpdatedAt && <p>Network last changed: <SourceTime value={result.introduction.networkUpdatedAt} /></p>}
        {result.introduction.checkedAt && <p>Paths checked: <SourceTime value={result.introduction.checkedAt} /> · Evidence must be no older than {result.introduction.maxEvidenceAgeDays ?? 365} days at the time of the check.</p>}
        {result.introduction.limited && <p>{result.introduction.limits?.every(limit => limit === 'path_count')
          ? 'Additional shortest paths exist. Results are capped per candidate.' : 'Search limits were reached. More paths may exist beyond the searched network.'}</p>}
        {result.introduction.excluded && <p>Excluded relationships: {result.introduction.excluded.follows} follow records, {result.introduction.excluded.unverified} unverified records, {result.introduction.excluded.stale} stale records.</p>}
        <Link className="presentation-inline-action" to="/network">Manage your network ↗</Link>
      </div>}
      {companyLoading.searchId && result.company.source === 'approved-source' && <button className="button button--secondary network-refresh-paths" type="button" disabled={refreshing} onClick={() => void refresh()}>{refreshing ? 'Checking paths…' : 'Refresh introduction paths'}</button>}
      {networkError && <p className="network-error" role="alert">{networkError}</p>}
      {incompleteCount > 0 && <p className="discovery-result-warnings">{incompleteCount} {incompleteCount === 1 ? 'path lacks' : 'paths lack'} complete, eligible evidence or person details. Refresh paths to check your current network.</p>}
      {resolvedPaths.length ? <div className="discovery-path-list">{resolvedPaths.map(({ path, people }, index) => <PathPanel key={path.id} path={path} people={people} connections={result.connections ?? []} index={index} />)}</div> : <div className="discovery-no-paths">
        <span className="discovery-state-symbol" aria-hidden="true">↗</span>
        <h3>{result.paths === null || incompleteCount ? 'Introduction paths are not available yet.' : 'No introduction path found.'}</h3>
        <p>{incompleteCount ? 'Some paths lack complete people, identity confirmation or relationship evidence and cannot be displayed.' : result.introduction ? pathReasons[result.introduction.status] : result.paths === null ? 'Company and people discovery is separate from connection discovery. No relationship source is connected, so we cannot establish a warm introduction. A social follow does not establish a trusted relationship.' : `We found ${company.name}, but no path was returned in the available network data. Try another company to continue exploring.`}</p>
        <button type="button" className="presentation-inline-action" onClick={onNewSearch}>Search another company <span aria-hidden="true">↗</span></button>
      </div>}
    </section>
  )
}
