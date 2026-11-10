import { AnimatedMetric } from './AnimatedMetric'
import { Link } from 'react-router-dom'
import type { NetworkDistribution, PlatformIntegration } from './data'

const currentIntegrations: readonly PlatformIntegration[] = [
  { id: 'linkedin', name: 'LinkedIn', status: 'unavailable' },
  { id: 'x', name: 'X', status: 'unavailable' },
]
const statusLabels = { connected: 'Connected', disconnected: 'Not connected', 'not-configured': 'Not configured', unavailable: 'Unavailable' }

export function NetworkSection({ integrations = currentIntegrations, connectionCount = null, distribution = null }: {
  integrations?: readonly PlatformIntegration[]
  connectionCount?: number | null
  distribution?: readonly NetworkDistribution[] | null
}) {
  const activeCount = integrations.filter((platform) => platform.status === 'connected').length
  const distributionTotal = distribution?.reduce((sum, item) => sum + item.count, 0) ?? 0

  return <section className="presentation-your-network" id="your-network" aria-labelledby="your-network-heading" tabIndex={-1} data-reveal>
    <div className="network-section-copy">
      <p className="presentation-eyebrow">04 / Your network</p>
      <h2 id="your-network-heading">Your people.<br /><span>A world of possibility.</span></h2>
      <p>Bring your relationships into view. See which platforms are connected and where your network can take you.</p>
      <dl className="network-summary">
        <div><dt>Active integrations</dt><dd><AnimatedMetric value={activeCount} /></dd></div>
        <div><dt>Available connections</dt><dd>{connectionCount == null ? <><span aria-hidden="true">—</span><span className="sr-only">Not available</span></> : <AnimatedMetric value={connectionCount} />}</dd></div>
      </dl>
      {!activeCount && <p className="presentation-data-note">No social platforms are connected. You can import authorised relationship data privately using CSV.</p>}
      <Link className="presentation-inline-action" to="/network">Manage imported connections ↗</Link>
    </div>
    <div className="network-platform-panel">
      <figure className="network-platform-map">
        <svg viewBox="0 0 440 260" role="img" aria-label={`Platform connection status: ${integrations.map((item) => `${item.name}, ${statusLabels[item.status]}`).join('; ')}.`}>
          {integrations.map((platform, index) => {
            const y = (index + 1) * 260 / (integrations.length + 1)
            return <g key={platform.id} data-connected={platform.status === 'connected'}>
              <path d={`M 130 130 C 220 130, 230 ${y}, 310 ${y}`} className="platform-connection-line" fill="none" pathLength="1" />
              <circle cx="340" cy={y} r="27" className="platform-map-circle" />
              <text x="340" y={y + 5} textAnchor="middle" className="platform-map-label">{platform.id === 'linkedin' ? 'in' : platform.name.slice(0, 2)}</text>
            </g>
          })}
          <circle cx="100" cy="130" r="42" className="platform-you-orbit" />
          <circle cx="100" cy="130" r="29" className="platform-you-circle" />
          <text x="100" y="134" textAnchor="middle" className="platform-you-label">YOU</text>
        </svg>
        <figcaption>Solid lines indicate active integrations. Dashed lines indicate inactive platforms.</figcaption>
      </figure>
      <ul className="platform-status-list" aria-label="Platform integrations">
        {integrations.map((platform) => <li key={platform.id}>
          <span className="platform-mark" aria-hidden="true">{platform.id === 'linkedin' ? 'in' : platform.name.slice(0, 2)}</span>
          <div><strong>{platform.name}</strong>{platform.status === 'connected' && platform.connectionCount != null && <small>{platform.connectionCount.toLocaleString()} connections</small>}</div>
          <span className={`platform-status platform-status--${platform.status}`}>{statusLabels[platform.status]}</span>
        </li>)}
      </ul>
      {distribution != null && distribution.length > 0 ? <div className="network-distribution">
        <h3>Network distribution</h3>
        <ul>{distribution.map((item) => <li key={item.label}><div><span>{item.label}</span><strong>{item.count.toLocaleString()}</strong></div><span className="distribution-track" aria-hidden="true"><span style={{ width: `${distributionTotal ? item.count / distributionTotal * 100 : 0}%` }} /></span></li>)}</ul>
      </div> : <p className="presentation-data-note">Network distribution is not available yet.</p>}
    </div>
  </section>
}
