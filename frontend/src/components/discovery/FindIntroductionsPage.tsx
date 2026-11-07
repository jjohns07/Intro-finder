import { useEffect, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { DashboardHeader } from '../dashboard/DashboardHeader'
import { DiscoveryWorkspace } from './DiscoveryWorkspace'
import { AppFooter } from '../AppFooter'

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
      <nav className="discovery-breadcrumb" aria-label="Breadcrumb"><Link to="/dashboard"><span aria-hidden="true">←</span> Back to dashboard</Link><span>Discovery / Companies & people</span></nav>
      <DiscoveryWorkspace key={location.key} initialCompany={initialCompany} />
      <AppFooter backToTop="#find-introductions" />
    </div>
  </div>
}
