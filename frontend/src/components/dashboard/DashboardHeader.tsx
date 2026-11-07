import { useEffect, useRef, useState, type ReactNode } from 'react'

type DashboardHeaderProps = {
  name: string
  email: string
  logo: ReactNode
  onLogout: () => void
  links: { href: string; label: string }[]
}

export function DashboardHeader({ name, email, logo, onLogout, links }: DashboardHeaderProps) {
  const [openPanel, setOpenPanel] = useState<'profile' | 'navigation' | null>(null)
  const controlsRef = useRef<HTMLDivElement>(null)
  const profileRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!openPanel) return

    const dismissOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !controlsRef.current?.contains(event.target)) {
        setOpenPanel(null)
      }
    }
    const dismissOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpenPanel(null)
        const trigger = openPanel === 'profile' ? profileRef : menuRef
        trigger.current?.focus()
      }
    }

    document.addEventListener('pointerdown', dismissOutside)
    document.addEventListener('keydown', dismissOnEscape)
    return () => {
      document.removeEventListener('pointerdown', dismissOutside)
      document.removeEventListener('keydown', dismissOnEscape)
    }
  }, [openPanel])

  return (
    <header className="presentation-header">
      <a className="presentation-brand" href="#overview" aria-label="Intro Finder overview">
        {logo}
        <span>Intro Finder</span>
      </a>
      <p className="presentation-greeting">Welcome back, <span>{name.trim().split(/\s+/)[0] || 'there'}.</span></p>
      <div
        className="presentation-header-controls"
        ref={controlsRef}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setOpenPanel(null)
        }}
      >
        <button
          className="presentation-profile-trigger"
          type="button"
          ref={profileRef}
          aria-label="View your profile"
          aria-expanded={openPanel === 'profile'}
          aria-controls="dashboard-profile"
          onClick={() => setOpenPanel(openPanel === 'profile' ? null : 'profile')}
        >
          <span aria-hidden="true">{name.trim().charAt(0).toUpperCase() || 'I'}</span>
        </button>
        {openPanel === 'profile' && (
          <section className="presentation-popover" id="dashboard-profile" aria-label="Your profile">
            <span className="presentation-eyebrow">Your account</span>
            <strong>{name}</strong>
            <p>{email}</p>
            <button className="button button--secondary button--full" type="button" onClick={onLogout}>Logout</button>
          </section>
        )}
        <button
          className="presentation-menu-trigger"
          type="button"
          ref={menuRef}
          aria-label={openPanel === 'navigation' ? 'Close navigation' : 'Open navigation'}
          aria-expanded={openPanel === 'navigation'}
          aria-controls="dashboard-navigation"
          onClick={() => setOpenPanel(openPanel === 'navigation' ? null : 'navigation')}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
            {openPanel === 'navigation'
              ? <path d="m6 6 12 12M6 18 18 6" />
              : <path d="M4 7h16M9 12h11M4 17h16" />}
          </svg>
        </button>
        {openPanel === 'navigation' && (
          <nav className="presentation-popover presentation-navigation" id="dashboard-navigation" aria-label="Dashboard sections">
            <span className="presentation-eyebrow">Explore your dashboard</span>
            {links.map((link, index) => (
              <a key={link.href} href={link.href} onClick={() => setOpenPanel(null)}>
                <span aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                {link.label}
                <span aria-hidden="true">↗</span>
              </a>
            ))}
            <button className="presentation-logout" type="button" onClick={onLogout}>Logout <span aria-hidden="true">↗</span></button>
          </nav>
        )}
      </div>
    </header>
  )
}
