import { Link } from 'react-router-dom'

export function AppFooter({ backToTop, compact = false }: { backToTop?: string; compact?: boolean }) {
  return <footer className={`app-footer${compact ? ' app-footer--compact' : ''}`}>
    {!compact && <div className="app-footer-brand"><span>Intro Finder</span><p>Meaningful connections. New possibilities.</p></div>}
    <nav className="app-footer-links" aria-label="Footer navigation">
      <Link to="/about">About This Project</Link>
      {backToTop && <a href={backToTop}>Back to top <span aria-hidden="true">↑</span></a>}
    </nav>
    <div className="app-footer-credit">
      <p>Designed &amp; Developed by John Daodu</p>
      <p>An independent software development project completed as part of SIWES.</p>
    </div>
  </footer>
}
