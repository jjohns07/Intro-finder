import { useId, useState, type KeyboardEvent, type PointerEvent } from 'react'
import type { ActivityData, ActivityPeriod, ActivityPoint } from './data'
import { MotionPresence } from '../motion/MotionPresence'

type ChartView = 'activity' | 'searches'
// Explicit chart examples; never used as account metrics, history, or paths.
const examples: Record<ActivityPeriod, readonly ActivityPoint[]> = {
  '30': [5, 12, 10, 19, 22, 20, 30, 35].map((connections, index) => ({ label: `Interval ${index + 1}`, connections, opportunities: [1, 2, 1, 4, 4, 6, 7, 10][index], searches: [2, 5, 3, 8, 6, 10, 7, 12][index] })),
  '90': [3, 8, 6, 15, 13, 24, 28, 36].map((connections, index) => ({ label: `Interval ${index + 1}`, connections, opportunities: [0, 1, 2, 2, 5, 4, 8, 12][index], searches: [4, 7, 5, 12, 9, 16, 13, 20][index] })),
}
const isCount = (value: number | null): value is number => value != null && Number.isFinite(value) && value >= 0
const formatCount = (value: number | null) => isCount(value) ? value.toLocaleString() : 'Not available'
const lineX = (index: number, length: number) => length === 1 ? 500 : index * 1000 / (length - 1)

type TooltipSnapshot = { point: ActivityPoint; view: ChartView; example: boolean; x: number }
function ActivityTooltip({ snapshot, id }: { snapshot: TooltipSnapshot | null; id: string }) {
  const [last, setLast] = useState(snapshot)
  // Keep the last content during a short, inert exit; compare fields rather
  // than object identity so pointer events cannot cause a render loop.
  if (snapshot && (!last || snapshot.point !== last.point || snapshot.view !== last.view || snapshot.example !== last.example || snapshot.x !== last.x)) setLast(snapshot)
  const content = snapshot ?? last
  if (!content) return null
  return <MotionPresence open={!!snapshot} id={id} role="tooltip" className="chart-tooltip" style={{ left: `clamp(0px, ${content.x / 10}% - 5.5rem, max(0px, 100% - 11rem))` }}><strong>{content.point.label}</strong>{content.example && <small>Example data</small>}<dl>{content.view === 'activity' ? <><div><dt>Connections</dt><dd>{formatCount(content.point.connections)}</dd></div><div><dt>Opportunities</dt><dd>{formatCount(content.point.opportunities)}</dd></div></> : <div><dt>Searches</dt><dd>{formatCount(content.point.searches)}</dd></div>}</dl></MotionPresence>
}

function chartPath(values: readonly (number | null)[], maximum: number) {
  let previous: { x: number; y: number } | null = null
  return values.map((value, index) => {
    if (!isCount(value)) { previous = null; return '' }
    const point = { x: lineX(index, values.length), y: 260 - value / maximum * 240 }
    const midpoint = previous ? (previous.x + point.x) / 2 : 0
    const segment = previous ? `C ${midpoint} ${previous.y}, ${midpoint} ${point.y}, ${point.x} ${point.y}` : `M ${point.x} ${point.y}`
    previous = point
    return segment
  }).join(' ')
}

export function MomentumSection({ data = null }: { data?: ActivityData | null }) {
  const [period, setPeriod] = useState<ActivityPeriod>('30')
  const [view, setView] = useState<ChartView>('activity')
  const [showExample, setShowExample] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const chartId = useId()
  const accountPoints = data?.[period]
  const isExample = !accountPoints?.length && showExample
  const points = accountPoints?.length ? accountPoints : isExample ? examples[period] : []
  const counts = points.flatMap((point) => view === 'searches' ? [point.searches] : [point.connections, point.opportunities]).filter(isCount)
  const hasValues = counts.length > 0
  const maximum = Math.max(10, Math.ceil(Math.max(0, ...counts) / 10) * 10)
  const selected = selectedIndex != null && hasValues ? points[selectedIndex] : undefined
  const pointX = (index: number) => view === 'searches' ? (index + 0.5) * 1000 / points.length : lineX(index, points.length)
  const selectedX = selected && selectedIndex != null ? pointX(selectedIndex) : 0
  const connectionsPath = chartPath(points.map((point) => point.connections), maximum)
  const intervals = accountPoints?.length
    ? [...new Set([0, Math.round((points.length - 1) / 3), Math.round((points.length - 1) * 2 / 3), points.length - 1])].map((index) => points[index].label)
    : period === '30' ? ['Start', '10 days', '20 days', '30 days'] : ['Start', '30 days', '60 days', '90 days']

  const selectPointer = (event: PointerEvent<HTMLDivElement>) => {
    if (!hasValues || (event.target instanceof Element && event.target.closest('.chart-tooltip'))) return
    const bounds = event.currentTarget.getBoundingClientRect()
    const fraction = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width))
    setSelectedIndex(Math.min(points.length - 1, view === 'searches' ? Math.floor(fraction * points.length) : Math.round(fraction * (points.length - 1))))
  }
  const selectKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!hasValues) return
    const last = points.length - 1
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End', 'Escape'].includes(event.key)) return
    event.preventDefault()
    if (event.key === 'Escape') setSelectedIndex(null)
    else if (event.key === 'Home') setSelectedIndex(0)
    else if (event.key === 'End') setSelectedIndex(last)
    else setSelectedIndex(selectedIndex == null ? 0 : Math.max(0, Math.min(last, selectedIndex + (event.key === 'ArrowRight' ? 1 : -1))))
  }

  return (
    <section className="presentation-momentum" id="momentum" aria-labelledby="momentum-heading" tabIndex={-1} data-reveal>
      <div className="presentation-momentum-heading">
        <div><p className="presentation-eyebrow">03 / Network activity</p><h2 id="momentum-heading">Small connections.<br /><span>Lasting momentum.</span></h2></div>
        <p>A wider view of your searches, relationships, and introduction opportunities over time.</p>
      </div>
      <div className="presentation-chart-panel" data-reveal="chart-panel">
        <div className="chart-view-control" role="group" aria-label="Chart view">
          <button type="button" aria-pressed={view === 'activity'} onClick={() => { setView('activity'); setSelectedIndex(null) }}>Network activity</button>
          <button type="button" aria-pressed={view === 'searches'} onClick={() => { setView('searches'); setSelectedIndex(null) }}>Company searches</button>
        </div>
        <div className="presentation-chart-toolbar">
          <div className="presentation-chart-legend" role="group" aria-label="Chart series">{view === 'activity' ? <><span><i className="legend-connections" /> Connections</span><span><i className="legend-opportunities" /> Introduction opportunities</span></> : <span><i className="legend-connections" /> Company searches</span>}</div>
          <div className="presentation-period-control" role="group" aria-label="Activity period">
            {(['30', '90'] as const).map((value) => <button key={value} type="button" aria-pressed={period === value} onClick={() => { setPeriod(value); setSelectedIndex(null) }}>{value} days</button>)}
          </div>
        </div>
        <div className="presentation-chart-state" role="status">
          {isExample ? <span className="presentation-example-badge">Illustrative example — not your activity</span> : <span>{hasValues ? 'Your activity' : accountPoints ? 'No activity recorded for this period' : 'No network activity available yet'}</span>}
          <span>{period}-day view</span>
        </div>
        <div className={`presentation-chart ${isExample ? 'is-example' : ''}`}>
          <div className="presentation-chart-scale" aria-hidden="true">{[1, .75, .5, .25, 0].map((ratio) => <span key={ratio}>{hasValues ? (maximum * ratio).toLocaleString() : ''}</span>)}</div>
          <div className="presentation-chart-plot" role="group" aria-label={`${view === 'activity' ? 'Network activity' : 'Company search'} chart`} tabIndex={hasValues ? 0 : undefined} aria-describedby={hasValues ? `${chartId}-help${selected ? ` ${chartId}-tooltip` : ''}` : undefined} onPointerMove={selectPointer} onPointerDown={selectPointer} onPointerLeave={() => setSelectedIndex(null)} onKeyDown={selectKey} onFocus={() => { if (hasValues) setSelectedIndex(0) }} onBlur={() => setSelectedIndex(null)}>
            <span id={`${chartId}-help`} className="sr-only">Use the left and right arrow keys to inspect intervals, Home and End to jump, or Escape to dismiss details. You can also hover or tap the chart.</span>
            <svg viewBox="0 0 1000 280" preserveAspectRatio="none" role="img" aria-label={hasValues ? `${isExample ? 'Illustrative example, not account data.' : 'Account activity.'} ${view === 'searches' ? 'Company searches' : 'Connections and introduction opportunities'} over ${period} days. Exact values are in the data table below.` : `No activity data is available for the ${period}-day view.`}>
              <defs><linearGradient id={chartId} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#55C5B7" stopOpacity="0.15" /><stop offset="100%" stopColor="#55C5B7" stopOpacity="0" /></linearGradient></defs>
              <g className="momentum-grid" stroke="currentColor" strokeWidth="1">{[20, 80, 140, 200, 260].map((y) => <path key={y} d={`M 0 ${y} H 1000`} vectorEffect="non-scaling-stroke" />)}</g>
              {hasValues && <g className="momentum-series" key={`${period}-${view}-${isExample}`}>
                {view === 'activity' ? <>
                  {points.every((point) => isCount(point.connections)) && points.length > 1 && <path d={`${connectionsPath} L 1000 260 L 0 260 Z`} fill={`url(#${chartId})`} className="momentum-area" />}
                  <path d={connectionsPath} className="momentum-connections" pathLength="1" fill="none" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
                  <path d={chartPath(points.map((point) => point.opportunities), maximum)} className="momentum-opportunities" fill="none" strokeWidth="2" strokeDasharray="5 5" vectorEffect="non-scaling-stroke" />
                  {points.map((point, index) => <g key={index}>{isCount(point.connections) && <circle cx={lineX(index, points.length)} cy={260 - point.connections / maximum * 240} r="3" className="momentum-point" />}{isCount(point.opportunities) && <circle cx={lineX(index, points.length)} cy={260 - point.opportunities / maximum * 240} r="2.5" className="momentum-point opportunity-point" />}</g>)}
                </> : points.map((point, index) => isCount(point.searches) && <rect key={index} x={pointX(index) - Math.min(70, 700 / points.length) / 2} y={260 - point.searches / maximum * 240} width={Math.min(70, 700 / points.length)} height={point.searches / maximum * 240} rx="3" className="momentum-bar" style={{ animationDelay: `${Math.min(index, 8) * 45}ms` }} />)}
              </g>}
              {selected && <path d={`M ${selectedX} 20 V 260`} className="chart-crosshair" vectorEffect="non-scaling-stroke" />}
            </svg>
            <ActivityTooltip id={`${chartId}-tooltip`} snapshot={selected ? { point: selected, view, example: isExample, x: selectedX } : null} />
            {!hasValues && <div className="presentation-chart-empty"><span className="presentation-chart-empty-symbol" aria-hidden="true">↗</span><strong>Your story is just beginning.</strong><p>{view === 'searches' ? 'Company search trends will appear here when search history is available.' : 'Your connections and introduction opportunities will appear here when network data is available.'}</p></div>}
          </div>
          <div className="presentation-chart-labels" aria-hidden="true">{intervals.map((label, index) => <span key={index} title={label}>{label}</span>)}</div>
        </div>
        <div className="presentation-chart-footer">
          <p>{isExample ? 'Sample values show how this chart will look with activity.' : hasValues ? 'Hover, tap, or use the arrow keys to explore your activity.' : 'See how your future activity could take shape.'}</p>
          {!accountPoints?.length && <button className="presentation-inline-action" type="button" aria-pressed={showExample} onClick={() => { setShowExample(!showExample); setSelectedIndex(null) }}>{showExample ? 'Close example' : 'Preview example'}<span aria-hidden="true">{showExample ? '×' : '↗'}</span></button>}
        </div>
        {hasValues && <details className="presentation-chart-table">
          <summary>{isExample ? 'View example data' : 'View activity data'}</summary>
          <table><caption>{isExample ? `Illustrative ${period}-day example. These are not your connections, searches, or opportunities.` : `Your activity over ${period} days. Missing values are marked as not available.`}</caption><thead><tr><th scope="col">Interval</th>{view === 'activity' ? <><th scope="col">Connections</th><th scope="col">Opportunities</th></> : <th scope="col">Searches</th>}</tr></thead><tbody>{points.map((point, index) => <tr key={index}><th scope="row">{point.label}</th>{view === 'activity' ? <><td>{formatCount(point.connections)}</td><td>{formatCount(point.opportunities)}</td></> : <td>{formatCount(point.searches)}</td>}</tr>)}</tbody></table>
        </details>}
      </div>
    </section>
  )
}
