import { useEffect, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { DashboardHeader } from '../dashboard/DashboardHeader'
import { AppFooter } from '../AppFooter'

const accountNavigation = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/find-introductions', label: 'Find introductions' },
  { href: '/history', label: 'Search history' },
  { href: '/network', label: 'Your network' },
  { href: '/settings', label: 'Settings' },
]

export type AccountPageProps = {
  user: { id: string; name: string; email: string }
  logo: ReactNode
  onLogout: () => void
}

export function AccountPageLayout({ user, logo, onLogout, title, children }: AccountPageProps & { title: string; children: ReactNode }) {
  const location = useLocation()
  useEffect(() => {
    const previous = document.title
    document.title = `${title} · Intro Finder`
    return () => { document.title = previous }
  }, [title])
  useEffect(() => {
    const target = location.hash ? document.getElementById(location.hash.slice(1)) : null
    if (target) {
      target.focus({ preventScroll: true })
      target.scrollIntoView({ behavior: 'instant', block: 'start' })
    } else {
      window.scrollTo({ top: 0, behavior: 'instant' })
    }
  }, [location.pathname, location.hash])

  return <div className="presentation-dashboard account-page">
    <a className="presentation-skip-link" href="#account-page-content">Skip to {title.toLowerCase()}</a>
    <div className="presentation-frame">
      <DashboardHeader name={user.name} email={user.email} logo={logo} onLogout={onLogout} brandHref="/dashboard" context={title} links={accountNavigation} />
      <nav className="account-breadcrumb" aria-label="Breadcrumb"><Link to="/dashboard"><span aria-hidden="true">←</span> Back to dashboard</Link><span>Intro Finder / {title}</span></nav>
      {children}
      <AppFooter backToTop="#account-page-content" />
    </div>
  </div>
}
