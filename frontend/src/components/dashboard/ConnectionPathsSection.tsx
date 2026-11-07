import { OpportunityPanel } from './OpportunityPanel'
import type { IntroductionOpportunity } from './data'

export function ConnectionPathsSection({ opportunities = null, onExplore }: {
  opportunities?: readonly IntroductionOpportunity[] | null
  onExplore?: (company: string) => void
}) {
  if (opportunities?.length) return <section className="presentation-paths has-opportunities" id="network-paths" aria-labelledby="paths-heading" tabIndex={-1} data-reveal>
    <div className="presentation-paths-copy"><p className="presentation-eyebrow">06 / Introduction opportunities</p><h2 id="paths-heading">Closer than you think.</h2><p>Follow the connections that can bring your next conversation within reach.</p></div>
    <div className="opportunity-list">{opportunities.map((opportunity) => <OpportunityPanel key={opportunity.id} opportunity={opportunity} onExplore={onExplore} />)}</div>
  </section>
  return (
    <section className="presentation-paths" id="network-paths" aria-labelledby="paths-heading" tabIndex={-1} data-reveal>
      <div className="presentation-paths-copy">
        <p className="presentation-eyebrow">06 / Introduction opportunities</p>
        <h2 id="paths-heading">Closer than<br />you think.</h2>
        <p>The person you want to meet could be one introduction away. Start with the people who already know you.</p>
        <p className="opportunity-availability">{opportunities == null ? 'Introduction paths are not available yet.' : 'No introduction opportunities found yet.'} The diagram illustrates how a path could work.</p>
        <ol className="presentation-path-steps">
          <li><span>01</span><div><strong>Start with your circle.</strong><p>Your existing relationships are the starting point.</p></div></li>
          <li><span>02</span><div><strong>Find the shared connection.</strong><p>A mutual contact can help you find common ground.</p></div></li>
          <li><span>03</span><div><strong>Make a meaningful introduction.</strong><p>Reach out with context and a clear reason to connect.</p></div></li>
        </ol>
        <a href="#explore" className="presentation-inline-action">Explore a company <span aria-hidden="true">↗</span></a>
      </div>
      <figure className="presentation-path-figure">
        <div className="presentation-path-figure-header"><span className="presentation-eyebrow">How a warm path works</span><span className="presentation-illustration-label">Illustration</span></div>
        <div className="presentation-path-diagram" role="img" aria-label="An illustrative introduction path: you, a shared connection, and the person you want to meet. This is not live network data.">
          <svg viewBox="0 0 540 380" className="presentation-path-lines" fill="none" aria-hidden="true" preserveAspectRatio="none">
            <path className="path-branch" d="M84 280C84 165 230 240 270 150M84 280C120 350 190 300 206 332M270 150C330 170 322 76 376 62" />
            <path className="path-main" pathLength="1" d="M84 280C155 280 165 150 270 150S380 88 456 88" />
            <circle className="path-branch-node" cx="206" cy="332" r="4" /><circle className="path-branch-node" cx="376" cy="62" r="4" />
          </svg>
          <div className="presentation-path-node path-node-you"><span className="path-node-circle"><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><circle cx="12" cy="8" r="3.5" /><path d="M5 21v-2a7 7 0 0 1 14 0v2" /></svg></span><strong>You</strong><small>Your starting point</small></div>
          <div className="presentation-path-node path-node-bridge"><span className="path-node-circle"><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true"><path d="m9 15 6-6m-7 3-2 2a3.5 3.5 0 0 0 5 5l3-3m-4-8 3-3a3.5 3.5 0 0 1 5 5l-2 2" /></svg></span><strong>Shared connection</strong><small>A trusted bridge</small></div>
          <div className="presentation-path-node path-node-target"><span className="path-node-circle"><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 18 18 6M6 6h12v12" /></svg></span><strong>Your next connection</strong><small>A new possibility</small></div>
        </div>
        <figcaption><span className="presentation-status-dot" /> Relationships turn a cold approach into a warm introduction.</figcaption>
      </figure>
    </section>
  )
}
