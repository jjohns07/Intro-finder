import { useEffect, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { AppFooter } from '../AppFooter'
import { DashboardHeader } from '../dashboard/DashboardHeader'
import { useSectionReveal } from '../dashboard/useSectionReveal'
import { WordReveal } from '../motion/WordReveal'

const objectives = [
  ['Discover with purpose', 'Make it easier to explore companies and identify founders and decision-makers you would like to meet.'],
  ['Understand the connection', 'Present introduction paths clearly when verified relationship data is available.'],
  ['Build an accessible experience', 'Bring account access, discovery and network insights together in a responsive, considered interface.'],
]

export function AboutProjectPage({ user, logo, onLogout }: {
  user: { name: string; email: string } | null
  logo: ReactNode
  onLogout: () => void
}) {
  const revealRef = useSectionReveal()
  useEffect(() => {
    const previousTitle = document.title
    document.title = 'About This Project · Intro Finder'
    window.scrollTo({ top: 0, behavior: 'instant' })
    return () => { document.title = previousTitle }
  }, [])

  return <div className="presentation-dashboard account-page about-page">
    <a className="presentation-skip-link" href="#about-project">Skip to project information</a>
    <div className="presentation-frame">
      {user ? <DashboardHeader name={user.name} email={user.email} logo={logo} onLogout={onLogout} brandHref="/dashboard" context="About This Project" links={[
        { href: '/dashboard', label: 'Dashboard' },
        { href: '/find-introductions', label: 'Find introductions' },
        { href: '/history', label: 'Search history' },
        { href: '/settings', label: 'Settings' },
        { href: '/about', label: 'About This Project' },
      ]} /> : <header className="presentation-header about-public-header">
        <Link className="presentation-brand" to="/login">{logo}<span>Intro Finder</span></Link>
        <Link className="about-login-link" to="/login">Login <span aria-hidden="true">↗</span></Link>
      </header>}
      <nav className="account-breadcrumb" aria-label="Breadcrumb"><Link to={user ? '/settings' : '/login'}><span aria-hidden="true">←</span> {user ? 'Back to settings' : 'Back to login'}</Link><span>Intro Finder / About</span></nav>
      <main className="account-main about-main" id="about-project" tabIndex={-1} ref={revealRef}>
        <header className="account-hero" data-reveal="hero">
          <p className="presentation-eyebrow"><span /> Learning through building</p>
          <h1 data-motion-text="words"><WordReveal text="About This" /><br /><span><WordReveal text="Project" start={2} /></span></h1>
          <p>A practical exploration of how thoughtful software can help people discover meaningful professional connections.</p>
        </header>

        <section className="about-introduction" aria-labelledby="about-name" data-reveal>
          <div><p className="presentation-eyebrow">The project</p><h2 id="about-name">Intro Finder</h2><p>Intro Finder is a professional networking application designed to help people explore companies and find potential warm introductions to founders and decision-makers through their existing network.</p></div>
          <dl className="about-facts">
            <div><dt>Project classification</dt><dd>SIWES Industrial Training Project</dd></div>
            <div><dt>Developer</dt><dd>John Daodu</dd></div>
            <div><dt>Programme</dt><dd>Student Industrial Work Experience Scheme (SIWES)</dd></div>
          </dl>
        </section>

        <section className="settings-section about-objectives" aria-labelledby="about-objectives" data-reveal>
          <div className="settings-section-copy"><p className="presentation-eyebrow">01 / The intention</p><h2 id="about-objectives">Project objectives</h2><p>Turn an idea for better introductions into a useful software experience.</p></div>
          <ol>{objectives.map(([title, description]) => <li key={title}><h3>{title}</h3><p>{description}</p></li>)}</ol>
        </section>

        <section className="settings-section" aria-labelledby="about-features" data-reveal>
          <div className="settings-section-copy"><p className="presentation-eyebrow">02 / The experience</p><h2 id="about-features">Key features</h2><p>A clear view of what the application provides today.</p></div>
          <div className="about-feature-list">
            <div><h3>Account access</h3><p>Email and password registration, login, authenticated routes and sign-out, with JWT session handling.</p></div>
            <div><h3>Discovery interface</h3><p>Company search, introduction-path views, activity visualisations and a searchable history interface, with clear loading, empty and unavailable states.</p></div>
            <div><h3>Personal preferences</h3><p>Account details and dark, light or system appearance, with theme preferences saved in the browser.</p></div>
            <div><h3>Responsive and accessible design</h3><p>Layouts for desktop, tablet and mobile, keyboard navigation, labelled controls and support for reduced motion.</p></div>
            <p className="about-availability">Company discovery, network data, saved search history and social sign-in still require backend or external integrations. The application identifies these as unavailable; it does not present invented connections as real results.</p>
          </div>
        </section>

        <section className="settings-section" aria-labelledby="about-technologies" data-reveal>
          <div className="settings-section-copy"><p className="presentation-eyebrow">03 / Behind the experience</p><h2 id="about-technologies">Technologies used</h2><p>Built with the tools in this project’s codebase.</p></div>
          <dl className="about-technologies">
            <div><dt>Frontend</dt><dd>React, TypeScript, React Router, Vite, Tailwind CSS and custom CSS.</dd></div>
            <div><dt>Backend</dt><dd>Node.js, Express and TypeScript.</dd></div>
            <div><dt>Data &amp; authentication</dt><dd>MongoDB with Mongoose, bcrypt password hashing and JSON Web Tokens (JWT).</dd></div>
            <div><dt>Motion &amp; quality</dt><dd>CSS animations, Intersection Observer, the Web Animations API and Oxlint.</dd></div>
          </dl>
        </section>
        <div className="about-recognition" data-reveal><p className="presentation-eyebrow">Independent project · SIWES</p><p>Developed by John Daodu as a SIWES Industrial Training Project. Intro Finder is independently developed and is not an officially sponsored SIWES product.</p></div>
      </main>
      <AppFooter backToTop="#about-project" />
    </div>
  </div>
}
