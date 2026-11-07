import { CompanyMark } from './CompanyMark'
import type { IntroductionOpportunity } from './data'

export function OpportunityPanel({ opportunity, onExplore }: { opportunity: IntroductionOpportunity; onExplore?: (company: string) => void }) {
  const completePath = opportunity.path.length >= 2
  const steps = completePath ? opportunity.path.length - 1 : null
  const strength = opportunity.strength
  const hasCalculatedStrength = strength && Number.isFinite(strength.score) && strength.score >= 0 && strength.score <= 1 && strength.explanation.trim()

  return <article className="opportunity-panel" data-reveal="path">
    <header><CompanyMark {...opportunity.company} /><div><p className="presentation-eyebrow">{opportunity.company.name}</p><h3>{opportunity.target.name}</h3>{opportunity.target.title && <p>{opportunity.target.title}</p>}</div><span className="opportunity-step-count">{steps == null ? 'Path incomplete' : `${steps} connection ${steps === 1 ? 'step' : 'steps'}`}</span></header>
    {completePath ? <ol className="opportunity-nodes" aria-label={`Introduction path to ${opportunity.target.name}`}>
      {opportunity.path.map((person, index) => <li key={`${person.id}-${index}`} data-position={index === 0 ? 'start' : index === opportunity.path.length - 1 ? 'target' : 'bridge'} style={{ '--path-delay': `${Math.min(index, 6) * 130}ms` } as React.CSSProperties}>
        <span className="opportunity-node" aria-hidden="true">{index === 0 ? 'YOU' : person.name.split(/\s+/).slice(0, 2).map((word) => word[0]).join('')}</span>
        <strong>{person.name}</strong><small>{index === 0 ? 'You' : index === opportunity.path.length - 1 ? (person.title || 'Target') : (person.title || 'Connecting person')}</small>
      </li>)}
    </ol> : <p className="presentation-data-note">A complete introduction path is not available yet.</p>}
    <footer>{hasCalculatedStrength ? <details className="opportunity-strength"><summary>Path strength: {Math.round(strength.score * 100)}%</summary><p>{strength.explanation}</p></details> : <p className="presentation-data-note">Path strength has not been calculated.</p>}{onExplore && <button type="button" className="presentation-inline-action" onClick={() => onExplore(opportunity.company.name)}>Explore company <span aria-hidden="true">↗</span></button>}</footer>
  </article>
}
