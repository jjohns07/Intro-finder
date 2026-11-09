import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { CompanyMark } from '../dashboard/CompanyMark'
import { safeWebUrl, type DiscoveryCompany, type DiscoveryCompanyDetails, type DiscoveryService } from '../../services/discovery'

export type CompanyInformationProps = {
  company: DiscoveryCompany
  initialDetails?: DiscoveryCompanyDetails
  searchId?: string
  loadDetails?: DiscoveryService['getCompanyDetails']
  onDetailsChange?: (companyId: string, details: DiscoveryCompanyDetails) => void
  autoLoadDetails?: boolean
}

const failures: Partial<Record<DiscoveryCompanyDetails['status'], string>> = {
  provider_error: 'The company information provider could not complete this request.',
  provider_timeout: 'The company information provider did not respond in time.',
  rate_limited: 'Company information has reached its request limit. Please try again later.',
  provider_access_denied: 'The provider denied access to detailed company information.',
  quota_exceeded: 'The provider has no company information credits available.',
  not_configured: 'Detailed company information is not connected for this source.',
}

function SourceDate({ value }: { value?: string }) {
  return value && Number.isFinite(Date.parse(value))
    ? <time dateTime={value}>{new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</time>
    : <>Date not supplied</>
}

function Fact({ label, children }: { label: string; children?: ReactNode }) {
  return <div><dt>{label}</dt><dd>{children ?? <span className="discovery-missing-field">Not provided</span>}</dd></div>
}

function ExternalLink({ url, children }: { url?: string; children: ReactNode }) {
  const safe = safeWebUrl(url)
  return safe ? <a href={safe} target="_blank" rel="noopener noreferrer">{children} <span aria-hidden="true">↗</span><span className="sr-only"> (opens in a new tab)</span></a> : null
}

export function CompanyInformation({ company: searchCompany, initialDetails, searchId, loadDetails, onDetailsChange, autoLoadDetails = true }: CompanyInformationProps) {
  const id = useId()
  const [details, setDetails] = useState(initialDetails)
  const [loading, setLoading] = useState(false)
  const [requestError, setRequestError] = useState('')
  const [expanded, setExpanded] = useState(false)
  const request = useRef<AbortController | null>(null)
  const canLoad = Boolean(searchId && loadDetails && searchCompany.source === 'approved-source' && searchCompany.attribution?.provider === 'Skrapp')

  const load = useCallback(async (refresh: boolean) => {
    if (!searchId || !loadDetails || request.current) return
    const controller = new AbortController()
    request.current = controller
    setLoading(true)
    setRequestError('')
    try {
      const next = await loadDetails(searchId, searchCompany.id, { signal: controller.signal, refresh })
      if (controller.signal.aborted || request.current !== controller) return
      setDetails(next)
      setLoading(false)
      onDetailsChange?.(searchCompany.id, next)
    } catch (error) {
      if (!controller.signal.aborted && request.current === controller) {
        setRequestError(error instanceof Error ? error.message : 'Company information could not be loaded. Please try again.')
      }
    } finally {
      if (request.current === controller) { request.current = null; setLoading(false) }
    }
  }, [searchId, searchCompany.id, loadDetails, onDetailsChange])

  useEffect(() => {
    // Delay the first call so a Strict Mode effect probe cannot send it twice.
    const start = window.setTimeout(() => { if (canLoad && autoLoadDetails && !initialDetails) void load(false) }, 0)
    return () => { window.clearTimeout(start); request.current?.abort(); request.current = null }
  }, [canLoad, autoLoadDetails, initialDetails, load])

  // Profile and search are separate source snapshots. Only supplied profile
  // values override the original card; a failed refresh retains its dated data.
  const company: DiscoveryCompany = { ...searchCompany, ...Object.fromEntries(Object.entries(details?.company ?? {}).filter(([, value]) => value != null)) }
  const website = safeWebUrl(company.website)
  const profile = safeWebUrl(company.profileUrl)
  const source = company.attribution?.provider || 'Data provider'
  const description = company.description
  const collapsible = Boolean(description && (description.length > 560 || description.split('\n').length > 6))
  const preview = description && collapsible && !expanded ? description.slice(0, 560).replace(/\s+\S*$/, '') + '…' : description
  const failure = requestError || (details ? failures[details.status] : undefined)
  const location = company.location || [...new Set([company.city, company.region, company.country].filter(Boolean))].join(', ') || undefined
  const missingDescription = loading ? 'Loading company description…'
    : failure ? 'A company description could not be retrieved.'
      : !details && canLoad && !autoLoadDetails ? 'A description was not saved with this search. Refresh company information to check the source.'
        : `A company description was not provided by ${source}.`

  return <article className="discovery-company" data-reveal aria-labelledby={`${id}-heading`}>
    <header className="discovery-company-top"><p className="presentation-eyebrow">Company overview</p><span className="discovery-company-source"><span aria-hidden="true" />{source}</span></header>
    <div className="discovery-company-grid">
      <section className="discovery-company-summary" aria-label="Company overview">
        <div className="discovery-company-identity"><CompanyMark name={company.name} logoUrl={safeWebUrl(company.logoUrl)} /><h2 id={`${id}-heading`}>{company.name}</h2></div>
        <div className="discovery-description-block">
          <p id={`${id}-description`} className="discovery-company-description" data-expanded={expanded || undefined}>{preview || <span className="discovery-missing-field">{missingDescription}</span>}</p>
          {collapsible && <button className="presentation-inline-action discovery-description-toggle" type="button" aria-expanded={expanded} aria-controls={`${id}-description`} onClick={() => setExpanded(value => !value)}>{expanded ? 'Show less' : 'Read full description'} <span aria-hidden="true">{expanded ? '−' : '+'}</span></button>}
          {description && <p className="discovery-description-source">{details?.descriptionField === 'meta_description' ? 'Website description via ' : 'Description from '}{source}</p>}
        </div>
        <dl className="discovery-company-facts discovery-overview-facts">
          <Fact label="Industry">{company.industry}</Fact>
          <Fact label="Country">{company.country}</Fact>
          <Fact label="Headquarters">{location}</Fact>
        </dl>
      </section>
      <section className="discovery-company-details" aria-labelledby={`${id}-details-heading`}>
        <h3 id={`${id}-details-heading`}>Company details</h3>
        <dl className="discovery-company-facts">
          <Fact label="Official website">{website ? <ExternalLink url={website}>{new URL(website).hostname}</ExternalLink> : undefined}</Fact>
          <Fact label="Employee range">{company.employeeRange}</Fact>
          <Fact label="Company domain">{company.domain}</Fact>
          <Fact label="City">{company.city}</Fact>
          <Fact label="State / region">{company.region}</Fact>
          <Fact label="Company LinkedIn">{profile ? <ExternalLink url={profile}>View company profile</ExternalLink> : undefined}</Fact>
          {typeof company.linkedinEmployeeCount === 'number' && <Fact label="People listed on LinkedIn"><span>{new Intl.NumberFormat().format(company.linkedinEmployeeCount)}</span><small>Provider count of LinkedIn members; may differ from total employees.</small></Fact>}
          {company.legalName && <Fact label="Legal name">{company.legalName}</Fact>}
          {company.companyType && <Fact label="Company type">{company.companyType}</Fact>}
          {typeof company.foundedYear === 'number' && <Fact label="Founded">{String(company.foundedYear)}</Fact>}
          {company.activityStatus && <Fact label="Operating status">{company.activityStatus}</Fact>}
        </dl>
      </section>
    </div>
    <div aria-live="polite" aria-atomic="true" className="discovery-company-feedback">
      {loading && <p role="status"><span className="discovery-spinner" aria-hidden="true" />{details ? 'Refreshing company information…' : 'Loading company information…'}</p>}
      {!loading && failure && <p role="alert">{failure} {details?.company ? 'Previously retrieved details remain visible with their original source date.' : 'The company match and executive results are still available.'}</p>}
      {!loading && !failure && details?.status === 'unavailable' && <p>The provider returned no additional company information. Available search details are shown above.</p>}
    </div>
    <footer className="discovery-company-footer">
      <div>
        <p className="discovery-source-note">{details?.cached ? 'Cached company information' : details?.retrievedAt ? 'Company information retrieved' : 'Company match retrieved'} · <SourceDate value={details?.retrievedAt ?? searchCompany.attribution?.retrievedAt} /></p>
        <details className="discovery-company-sources"><summary>Company information sources</summary>
          <p>Company match: {searchCompany.attribution?.provider || 'Source not supplied'} · <SourceDate value={searchCompany.attribution?.retrievedAt} /></p>
          {details?.retrievedAt && <p>Company profile: {details.company?.attribution?.provider || source} · <SourceDate value={details.retrievedAt} /></p>}
          {details?.providerUpdatedAt && <p>Last updated by the provider: <SourceDate value={details.providerUpdatedAt} /></p>}
          {company.attribution && <p>Source record: {company.attribution.recordId}</p>}
          <p>Company information is supplied by the provider and may change. Fields not supplied are marked “Not provided”.</p>
        </details>
      </div>
      {canLoad && <button type="button" className="button button--secondary discovery-company-refresh" disabled={loading} onClick={() => void load(true)}><span aria-hidden="true">↻</span> Refresh company information</button>}
    </footer>
  </article>
}
