import { useCallback, useEffect, useRef, useState } from 'react'
import { companyDiscovery, DiscoveryUnavailableError, type DiscoveryResult, type DiscoveryService } from '../../services/discovery'
import { DiscoveryArtwork, SearchIcon } from './DiscoveryArtwork'
import { DiscoveryResults } from './DiscoveryResults'
import { useSectionReveal } from '../dashboard/useSectionReveal'
import { WordReveal } from '../motion/WordReveal'

type SearchState =
  | { kind: 'idle' }
  | { kind: 'loading' | 'not-found' | 'unavailable'; query: string }
  | { kind: 'error'; query: string; timedOut?: boolean }
  | { kind: 'success'; query: string; result: DiscoveryResult }

export function DiscoveryWorkspace({ initialCompany = '', service = companyDiscovery }: {
  initialCompany?: string
  service?: DiscoveryService
}) {
  const [companyName, setCompanyName] = useState(initialCompany)
  const [validation, setValidation] = useState('')
  const [state, setState] = useState<SearchState>({ kind: 'idle' })
  const inputRef = useRef<HTMLInputElement>(null)
  const revealRef = useSectionReveal()
  const requestRef = useRef<AbortController | null>(null)

  const cancelRequest = useCallback(() => {
    requestRef.current?.abort()
    requestRef.current = null
  }, [])

  const runSearch = useCallback(async (value: string) => {
    if (requestRef.current) return
    const query = value.trim()
    if (!query || query.length > 160) {
      setValidation(!query ? 'Please enter a company name before searching.' : 'Use a company name with 160 characters or fewer.')
      inputRef.current?.focus()
      return
    }
    setValidation('')
    setCompanyName(query)
    setState({ kind: 'loading', query })
    const controller = new AbortController()
    requestRef.current = controller
    const timeout = window.setTimeout(() => {
      if (requestRef.current !== controller) return
      controller.abort()
      requestRef.current = null
      setState({ kind: 'error', query, timedOut: true })
    }, 20_000)
    controller.signal.addEventListener('abort', () => window.clearTimeout(timeout), { once: true })
    try {
      const result = await service.search(query, { signal: controller.signal })
      if (controller.signal.aborted || requestRef.current !== controller) return
      setState(result ? { kind: 'success', query, result } : { kind: 'not-found', query })
    } catch (error) {
      if (controller.signal.aborted || requestRef.current !== controller) return
      setState({ kind: error instanceof DiscoveryUnavailableError ? 'unavailable' : 'error', query })
    } finally {
      window.clearTimeout(timeout)
      if (requestRef.current === controller) requestRef.current = null
    }
  }, [service])

  useEffect(() => {
    // A dashboard submission starts an external discovery request on arrival.
    // oxlint-disable-next-line react/set-state-in-effect
    if (initialCompany) void runSearch(initialCompany)
    return cancelRequest
  }, [initialCompany, runSearch, cancelRequest])

  const editSearch = (value: string) => {
    cancelRequest()
    setCompanyName(value)
    setValidation('')
    setState({ kind: 'idle' })
  }
  const newSearch = () => {
    editSearch('')
    inputRef.current?.focus()
  }
  const loading = state.kind === 'loading'
  const announcement = state.kind === 'loading' ? `Searching for ${state.query}.`
    : state.kind === 'success' ? `Company result for ${state.result.company.name} is ready below.`
    : state.kind === 'not-found' ? `No company found for ${state.query}.`
    : state.kind === 'unavailable' ? 'Company discovery is not connected yet. No search was performed.'
    : state.kind === 'error' ? state.timedOut ? 'The search took too long. Please try again.' : 'The search could not be completed. Please try again.' : ''

  return (
    <main className="discovery-main" id="find-introductions" tabIndex={-1} ref={revealRef}>
      <section className="discovery-hero" aria-labelledby="discovery-heading" data-reveal="hero">
        <div className="discovery-hero-copy">
          <p className="presentation-eyebrow"><span /> Find introductions</p>
          <h1 id="discovery-heading" data-motion-text="words"><WordReveal text="Who do you" /><br /><WordReveal text="want to " start={3} /><span><WordReveal text="meet?" start={5} /></span></h1>
          <p>Search for a company and discover the people who can connect you to its founders and decision-makers.</p>
        </div>
        <DiscoveryArtwork />
        <span className="discovery-hero-caption" aria-hidden="true">A company. A connection. A conversation.</span>
      </section>

      <section className="discovery-search" aria-label="Find a company" data-reveal="search">
        <form onSubmit={event => { event.preventDefault(); void runSearch(companyName) }} noValidate role="search" aria-label="Company discovery">
          <label htmlFor="discovery-company-input">Start with a company</label>
          <div className="discovery-search-bar" data-invalid={!!validation}>
            <div className="discovery-search-field"><SearchIcon />
              <input id="discovery-company-input" name="companyName" ref={inputRef} value={companyName} onChange={event => editSearch(event.target.value)} placeholder="Enter a company name" aria-label="Company name" aria-invalid={!!validation} aria-describedby={validation ? 'discovery-validation' : 'discovery-search-note'} autoComplete="off" enterKeyHint="search" spellCheck={false} />
              {companyName && <button className="discovery-clear" type="button" aria-label={loading ? 'Cancel and clear search' : 'Clear search'} onClick={newSearch}><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6" /></svg></button>}
            </div>
            <button type="submit" className="button button--primary discovery-submit" disabled={loading}>
              {loading ? <><span className="discovery-spinner" aria-hidden="true" /> Searching…</> : <>Find introductions <span aria-hidden="true">↗</span></>}
            </button>
          </div>
          {validation && <p className="discovery-validation" id="discovery-validation" role="alert">{validation}</p>}
          <div className="discovery-search-meta"><p id="discovery-search-note">Search by company name. Every introduction starts with a little curiosity.</p><span><span aria-hidden="true">↵</span> Enter to search</span></div>
        </form>
      </section>

      {!service.available && state.kind !== 'unavailable' && <p className="discovery-availability"><span aria-hidden="true" />Company discovery is not connected yet. Results will be available when search is connected.</p>}
      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">{announcement}</p>
      <div className="discovery-state-container" aria-busy={loading}>
        {state.kind === 'idle' && <section className="discovery-start" aria-labelledby="discovery-start-heading" data-reveal="editorial">
          <div className="discovery-start-heading"><p className="presentation-eyebrow">From curiosity to connection</p><h2 id="discovery-start-heading">Your next conversation<br /> starts here<span>.</span></h2></div>
          <ol className="discovery-guide">
            <li><span>01</span><div><h3>Find the company</h3><p>Start with a name you’re curious about.</p></div></li>
            <li><span>02</span><div><h3>Get to know the people</h3><p>Explore founders and decision-makers when their details are available.</p></div></li>
            <li><span>03</span><div><h3>Discover a way in</h3><p>Follow introduction paths supported by available connection data.</p></div></li>
          </ol>
        </section>}

        {loading && <section className="discovery-loading discovery-state-card" aria-labelledby="discovery-loading-heading">
          <span className="discovery-state-symbol" aria-hidden="true"><SearchIcon /></span>
          <div><p className="presentation-eyebrow">Discovery in progress</p><h2 id="discovery-loading-heading">Looking for {state.query}<span>…</span></h2><p>Company information and available introduction paths will appear here.</p><button type="button" className="presentation-inline-action" onClick={() => { cancelRequest(); setState({ kind: 'idle' }); inputRef.current?.focus() }}>Cancel search <span aria-hidden="true">×</span></button></div>
          <div className="discovery-skeleton" aria-hidden="true"><span /><span /><span /></div>
        </section>}

        {state.kind === 'unavailable' && <section className="discovery-state-card" aria-labelledby="discovery-unavailable-heading">
          <span className="discovery-state-symbol" aria-hidden="true">↗</span>
          <div><p className="presentation-eyebrow">Discovery is on its way</p><h2 id="discovery-unavailable-heading">The first connection<br />is still to come<span>.</span></h2><p>Company discovery is not connected yet, so we couldn’t search for <strong>{state.query}</strong>. Your search will be available once the service is connected.</p><div className="discovery-platform-notes"><span>LinkedIn <small>Not configured</small></span><span>X <small>Not configured</small></span></div><button type="button" className="presentation-inline-action" onClick={newSearch}>Start a new search <span aria-hidden="true">↗</span></button></div>
        </section>}

        {state.kind === 'not-found' && <section className="discovery-state-card" aria-labelledby="discovery-not-found-heading">
          <span className="discovery-state-symbol" aria-hidden="true"><SearchIcon /></span><div><p className="presentation-eyebrow">Keep exploring</p><h2 id="discovery-not-found-heading">No company found<span>.</span></h2><p>We couldn’t find <strong>{state.query}</strong> in the available data. Check the spelling, use the company’s full name, or try another company.</p><button className="presentation-inline-action" type="button" onClick={() => { inputRef.current?.focus(); inputRef.current?.select() }}>Refine your search <span aria-hidden="true">↗</span></button></div>
        </section>}

        {state.kind === 'error' && <section className="discovery-state-card discovery-error" aria-labelledby="discovery-error-heading">
          <span className="discovery-state-symbol" aria-hidden="true">!</span><div><p className="presentation-eyebrow">A pause in discovery</p><h2 id="discovery-error-heading">{state.timedOut ? 'This is taking too long.' : 'We couldn’t complete your search.'}</h2><p>{state.timedOut ? 'The search service did not respond in time.' : 'Something interrupted the search service.'} Your company name is still here. Please try again.</p><button className="button button--secondary" type="button" onClick={() => void runSearch(state.query)}>Try again <span aria-hidden="true">↗</span></button></div>
        </section>}
        {state.kind === 'success' && <DiscoveryResults key={state.query} result={state.result} onNewSearch={newSearch} />}
      </div>
      <footer className="discovery-closing"><span aria-hidden="true">↗</span><p>Meaningful introductions.<br /><strong>New possibilities.</strong></p><span>Let curiosity lead the way.</span></footer>
    </main>
  )
}
