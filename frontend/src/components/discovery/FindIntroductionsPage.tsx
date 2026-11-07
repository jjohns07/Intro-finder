import { useEffect, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { DashboardHeader } from '../dashboard/DashboardHeader'
import { DiscoveryWorkspace } from './DiscoveryWorkspace'

export function FindIntroductionsPage({ user, logo, onLogout }: {
  user: { name: string; email: string }
  logo: ReactNode
  onLogout: () => void
}) {
  const location = useLocation()
  const initialCompany = new URLSearchParams(location.search).get('company') ?? ''
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
    const previousTitle = document.title
    document.title = 'Find Introductions · Intro Finder'
    return () => { document.title = previousTitle }
  }, [])
  return <div className="presentation-dashboard discovery-page">
    <a className="presentation-skip-link" href="#find-introductions">Skip to company search</a>
    <div className="presentation-frame">
      <DashboardHeader name={user.name} email={user.email} logo={logo} onLogout={onLogout} brandHref="/dashboard" context="Find introductions" links={[
        { href: '/dashboard', label: 'Dashboard' },
        { href: '/find-introductions', label: 'Find introductions' },
        { href: '/dashboard#your-network', label: 'Your network' },
        { href: '/dashboard#activity', label: 'Recent searches' },
        { href: '/history', label: 'Search history' },
        { href: '/settings', label: 'Settings' },
      ]} />
      <div className="discovery-breadcrumb"><Link to="/dashboard"><span aria-hidden="true">←</span> Back to dashboard</Link><span>Discovery / Company search</span></div>
      <DiscoveryWorkspace key={location.key} initialCompany={initialCompany} />
      <footer className="presentation-footer"><span>Intro Finder</span><p>Meaningful connections. New possibilities.</p><a href="#find-introductions">Back to top ↑</a></footer>
    </div>
  </div>
}
