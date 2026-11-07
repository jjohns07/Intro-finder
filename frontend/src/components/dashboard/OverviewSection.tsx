import { AnimatedMetric } from './AnimatedMetric'

export type OverviewMetrics = {
  totalConnections: number | null
  companiesExplored: number | null
  introductionOpportunities: number | null
  successfulIntroductions?: number | null
}

const emptyMetrics: OverviewMetrics = {
  totalConnections: null,
  companiesExplored: null,
  introductionOpportunities: null,
}

export function OverviewSection({ metrics = emptyMetrics }: { metrics?: OverviewMetrics }) {
  const statistics = [
    { label: 'Total connections', value: metrics.totalConnections, context: 'People in your connected network.' },
    { label: 'Companies explored', value: metrics.companiesExplored, context: 'The companies behind your curiosity.' },
    { label: 'Introduction opportunities', value: metrics.introductionOpportunities, context: 'Available paths to your next conversation.' },
    ...(metrics.successfulIntroductions != null
      ? [{ label: 'Successful introductions', value: metrics.successfulIntroductions, context: 'Connections that became conversations.' }]
      : []),
  ]
  const hasUnavailableMetrics = statistics.some(({ value }) => value == null)

  return (
    <section className="presentation-overview" id="overview" aria-labelledby="overview-heading" tabIndex={-1} data-reveal>
      <div className="presentation-section-topline">
        <p className="presentation-eyebrow"><span className="presentation-status-dot" /> Your network, at a glance</p>
        <span className="presentation-section-number" aria-hidden="true">01 / Overview</span>
      </div>
      <div className="presentation-overview-grid">
        <div className="presentation-overview-copy">
          <h1 id="overview-heading">Your Network.<br /><span>New Possibilities.</span></h1>
          <p>Discover meaningful connections and find your way to the people who matter.</p>
          <a className="button button--primary presentation-primary-action" href="#explore">
            Explore introductions
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 12h16m-6-6 6 6-6 6" /></svg>
          </a>
        </div>
        <figure className="presentation-network-art">
          <svg viewBox="0 0 440 360" aria-hidden="true" focusable="false">
            <g className="network-orbits" fill="none" stroke="currentColor" strokeWidth="1">
              <ellipse cx="220" cy="180" rx="191" ry="89" transform="rotate(-35 220 180)" />
              <ellipse cx="220" cy="180" rx="191" ry="89" transform="rotate(35 220 180)" />
              <ellipse cx="220" cy="180" rx="87" ry="164" />
              <circle cx="220" cy="180" r="129" strokeDasharray="2 8" />
            </g>
            <g className="network-paths" fill="none" stroke="currentColor" strokeWidth="1.4">
              <path d="M220 180 91 115M220 180 352 99M220 180 342 269M220 180 96 249" />
              <path d="m91 115 129-73 132 57" strokeDasharray="3 6" />
            </g>
            <g className="network-nodes" fill="currentColor">
              <circle cx="91" cy="115" r="5" /><circle cx="352" cy="99" r="5" />
              <circle cx="342" cy="269" r="4" /><circle cx="96" cy="249" r="4" />
              <circle cx="220" cy="42" r="3" /><circle cx="219" cy="317" r="3" />
            </g>
            <circle className="network-center-ring" cx="220" cy="180" r="38" fill="none" stroke="currentColor" />
            <circle className="network-center" cx="220" cy="180" r="29" />
            <text x="220" y="185" textAnchor="middle" className="network-center-label">YOU</text>
          </svg>
          <figcaption><span /> Every connection opens a possibility.</figcaption>
          <span className="sr-only">Illustration of possible connections, not live network data.</span>
        </figure>
      </div>
      <div className="presentation-overview-footer">
        <dl className="presentation-statistics" aria-label="Network overview statistics">
          {statistics.map(({ label, value, context }) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value == null ? <><span aria-hidden="true">—</span><span className="sr-only">Not available</span></> : <AnimatedMetric value={value} />}</dd>
              <dd className="statistic-context">{context}</dd>
            </div>
          ))}
        </dl>
        {hasUnavailableMetrics && <p className="presentation-data-note">Your overview will appear here when network data is connected.</p>}
      </div>
    </section>
  )
}
