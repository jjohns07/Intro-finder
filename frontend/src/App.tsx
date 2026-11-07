import { useEffect, useRef, useState, type ReactNode } from 'react'
import { BrowserRouter, Navigate,   Route, Routes, useNavigate } from 'react-router-dom'
import './App.css'
import './styles/auth.css'
import './styles/dashboard.css'
import './styles/dashboard-refinements.css'
import './styles/discovery.css'
import './styles/account.css'
import './styles/motion.css'
import './styles/project.css'
import { AppFooter } from './components/AppFooter'
import { AboutProjectPage } from './components/account/AboutProjectPage'
import { PageTransition } from './components/motion/PageTransition'
import { SearchHistoryPage } from './components/account/SearchHistoryPage'
import { SettingsPage } from './components/account/SettingsPage'
import { FindIntroductionsPage } from './components/discovery/FindIntroductionsPage'
import { DashboardHeader } from './components/dashboard/DashboardHeader'
import { OverviewSection } from './components/dashboard/OverviewSection'
import { ConnectionPathsSection } from './components/dashboard/ConnectionPathsSection'
import { MomentumSection } from './components/dashboard/MomentumSection'
import { useSectionReveal } from './components/dashboard/useSectionReveal'
import { NetworkSection } from './components/dashboard/NetworkSection'
import { RecentSearchesSection } from './components/dashboard/RecentSearchesSection'
import { DiscoverySection } from './components/dashboard/DiscoverySection'
import architecturePhoto from './assets/auth-entrance.jpg'
import { AuthIcon, AuthInput, PasswordField } from './components/AuthFields'

type AuthMode = 'login' | 'register'

type User = {
  id: string
  name: string
  email: string
}

type AuthFormState = {
  name: string
  email: string
  password: string
  confirmPassword: string
}

type StatusState = {
  type: 'success' | 'error'
  text: string
}

const API_BASE_URL = 'https://intro-finder-api.onrender.com/api/auth'
const TOKEN_STORAGE_KEY = 'introfinder_token'

const getStoredToken = (): string | null => sessionStorage.getItem(TOKEN_STORAGE_KEY)

const setStoredToken = (token: string): void => {
  sessionStorage.setItem(TOKEN_STORAGE_KEY, token)
}

const clearStoredToken = (): void => {
  sessionStorage.removeItem(TOKEN_STORAGE_KEY)
}

const getAuthHeaders =   (tokenOverride?: string | null): HeadersInit => {
  const token = tokenOverride ?? getStoredToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  return headers
}

const initialFormState: AuthFormState = {
  name: '',
  email: '',
  password: '',
  confirmPassword: '',
}

function GoogleLogo() {
  return (
    <svg className="google-logo" viewBox="0 0 18 18" aria-hidden="true" focusable="false">
      <path fill="#4285F4" d="M17.64 9.205c0-.638-.057-1.252-.164-1.841H9v3.482h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.258h2.909c1.702-1.567 2.683-3.875 2.683-6.615z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.468-.806 5.957-2.18l-2.909-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.583-5.036-3.71H.957v2.332C2.438 15.983 5.482 18 9 18z" />
      <path fill="#FBBC05" d="M3.964 10.712A5.41 5.41 0 0 1 3.682 9c0-.594.102-1.17.282-1.712V4.956H.957A9.002 9.002 0 0 0 0 9c0 1.452.347 2.827.957 4.044l3.007-2.332z" />
      <path fill="#EA4335" d="M9 3.578c1.321 0 2.507.454 3.44 1.346l2.581-2.581C13.464.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.956l3.007 2.332C4.672 5.161 6.656 3.578 9 3.578z" />
    </svg>
  )
}

function LogoMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`brand-mark ${compact ? 'compact' : ''}`} aria-hidden="true">
      <svg viewBox="0 0 52 52" focusable="false">
        <circle cx="19" cy="25" r="8.5" fill="none" stroke="currentColor" strokeWidth="2.8" />
        <path d="M27.4 22.9c3.5 0 6.6 2.8 7 6.3l1.7 8.1c.2 1.6-1 3-2.6 3H18.5c-1.6 0-2.8-1.4-2.6-3l1.7-8.1c.4-3.5 3.5-6.3 7-6.3Z" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinejoin="round" />
        <path d="M30.5 12.5a6 6 0 0 1 8.2 8.3M38.5 15l-8 8.3" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
        <path d="M41.5 19.5 46.5 15" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
      </svg>
    </div>
  )
}

function AuthScreen({
  onAuthenticated,
}: {
  onAuthenticated: (user: User) => void
}) {
  const navigate = useNavigate()
  const [mode, setMode] = useState<AuthMode>('login')
  const [formData, setFormData] = useState<AuthFormState>(initialFormState)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [status, setStatus] = useState<StatusState | null>(null)
  const [errors, setErrors] = useState<Partial<Record<keyof AuthFormState, string>>>({})
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isSwitching, setIsSwitching] = useState(false)
  const [copyrightYear] = useState(() => new Date().getFullYear())
  const switchTimer = useRef<number | undefined>(undefined)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const focusAfterSwitch = useRef(false)
  const isLogin = mode === 'login'

  useEffect(() => () => window.clearTimeout(switchTimer.current), [])

  useEffect(() => {
    const previousTitle = document.title
    document.title = `${isLogin ? 'Login' : 'Create Account'} · Intro Finder`
    return () => { document.title = previousTitle }
  }, [isLogin])

  useEffect(() => {
    if (focusAfterSwitch.current) {
      headingRef.current?.focus({ preventScroll: true })
      focusAfterSwitch.current = false
    }
  }, [mode])

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target
    setFormData((current) => ({ ...current, [name]: value }))
    setErrors((current) => ({ ...current, [name]: undefined }))
    setStatus(null)
  }

  const handleModeChange = (nextMode: AuthMode) => {
    if (isSubmitting || isSwitching || nextMode === mode) return

    const finishSwitch = () => {
      focusAfterSwitch.current = true
      setMode(nextMode)
      setStatus(null)
      setErrors({})
      setShowPassword(false)
      setShowConfirmPassword(false)
      setFormData(initialFormState)
      setIsSwitching(false)
    }

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      finishSwitch()
    } else {
      setIsSwitching(true)
      switchTimer.current = window.setTimeout(finishSwitch, 140)
    }
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (isSubmitting || isSwitching) return
    setStatus(null)

    const email = formData.email.trim()
    const password = formData.password
    const nextErrors: Partial<Record<keyof AuthFormState, string>> = {}

    if (!isLogin && formData.name.trim().length < 2) {
      nextErrors.name = 'Name must be at least 2 characters long.'
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      nextErrors.email = 'Please enter a valid email address.'
    }
    if (!password) {
      nextErrors.password = 'Please enter your password.'
    } else if (!isLogin && password.length < 8) {
      nextErrors.password = 'Password must be at least 8 characters long.'
    }
    if (!isLogin && formData.password !== formData.confirmPassword) {
      nextErrors.confirmPassword = 'Passwords do not match.'
    }
    setErrors(nextErrors)

    const firstInvalidField = Object.keys(nextErrors)[0]
    if (firstInvalidField) {
      document.getElementById(firstInvalidField)?.focus()
      return
    }

    setIsSubmitting(true)

    try {
      const endpoint = isLogin ? `${API_BASE_URL}/login` : `${API_BASE_URL}/register`
      const payload = isLogin
        ? { email, password }
        : { name: formData.name.trim(), email, password }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(data.message || 'Authentication failed. Please try again.')
      }

      if (data.token) {
        setStoredToken(data.token)
      } else {
        clearStoredToken()
      }

      if (data.user) {
        onAuthenticated(data.user)
      }

      setFormData(initialFormState)
      navigate('/dashboard', { replace: true })
    } catch (error) {
      setStatus({
        type: 'error',
        text: error instanceof Error ? error.message : 'Something went wrong.',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="auth-experience">
      <a className="presentation-skip-link" href="#auth-content">Skip to {isLogin ? 'login' : 'registration'}</a>
      <aside className="auth-visual" aria-label="Welcome to Intro Finder">
        <img className="auth-architecture" src={architecturePhoto} alt="" width="1600" height="1067" fetchPriority="high" />
        <div className="auth-visual-overlay" />
        <div className="auth-visual-content">
          <div className="auth-brand">
            <LogoMark />
            <span>Intro Finder</span>
          </div>

          <div className="auth-welcome" key={mode}>
            <div className="auth-welcome-rule" />
            <div className="auth-reveal-mask">
              <h2>{isLogin ? 'Welcome Back' : 'Your Next Chapter'}</h2>
            </div>
            <p>
              {isLogin
                ? "Glad to see you again. Let's continue where you left off."
                : 'Meaningful connections. New possibilities. It all starts here.'}
            </p>
          </div>

          <small className="auth-copyright">© {copyrightYear} Intro Finder. All rights reserved.</small>
        </div>
      </aside>

      <main className="auth-stage" id="auth-content" tabIndex={-1}>
        <section className="auth-entry-card" data-mode={mode} aria-labelledby="auth-title">
          <div key={mode} className={`auth-card-body ${isSwitching ? 'is-switching' : ''}`}>
            <div className="auth-card-emblem"><LogoMark /></div>
            <header className="auth-heading">
              <h1 id="auth-title" ref={headingRef} tabIndex={-1}>{isLogin ? 'Login' : 'Create Account'}</h1>
              <p>{isLogin ? 'Login to your account to continue.' : 'Join Intro Finder and turn your network into meaningful introductions.'}</p>
            </header>

            <form className="auth-form" onSubmit={handleSubmit} noValidate aria-busy={isSubmitting} aria-label={isLogin ? 'Login' : 'Create account'}>
              <fieldset className="auth-fields" disabled={isSubmitting || isSwitching}>
                <legend className="sr-only">{isLogin ? 'Login details' : 'Registration details'}</legend>
                {!isLogin && (
                  <AuthInput id="name" name="name" label="Full name" icon="person" value={formData.name} onChange={handleChange} placeholder="Alex Lee" autoComplete="name" error={errors.name} />
                )}
                <AuthInput id="email" name="email" type="email" label="Email address" icon="email" value={formData.email} onChange={handleChange} placeholder="you@example.com" autoComplete="email" error={errors.email} />
                <PasswordField
                  id="password"
                  name="password"
                  label="Password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder={isLogin ? 'Enter your password' : 'Create a password'}
                  autoComplete={isLogin ? 'current-password' : 'new-password'}
                  show={showPassword}
                  onToggle={() => setShowPassword((current) => !current)}
                  hint={isLogin ? undefined : 'Use at least 8 characters.'}
                  error={errors.password}
                />
                {!isLogin && (
                  <PasswordField id="confirmPassword" name="confirmPassword" label="Confirm password" value={formData.confirmPassword} onChange={handleChange} placeholder="Repeat your password" autoComplete="new-password" show={showConfirmPassword} onToggle={() => setShowConfirmPassword((current) => !current)} error={errors.confirmPassword} />
                )}
              </fieldset>

              {Object.values(errors).some(Boolean) && <p className="sr-only" role="alert">Please review the highlighted fields.</p>}
              {status && <div className={`form-status auth-feedback ${status.type}`} role="alert">{status.text}</div>}

              <button type="submit" className="primary-button auth-submit" disabled={isSubmitting || isSwitching}>
                {isSubmitting && <span className="auth-spinner" aria-hidden="true" />}
                <span>{isSubmitting ? (isLogin ? 'Logging in…' : 'Creating account…') : (isLogin ? 'Login' : 'Create Account')}</span>
                {!isSubmitting && <AuthIcon name="arrow" />}
              </button>
              <span className="sr-only" role="status">{isSubmitting ? (isLogin ? 'Logging in. Please wait.' : 'Creating your account. Please wait.') : ''}</span>
            </form>

            {isLogin && <div className="auth-social">
              <div className="divider"><span>or continue with</span></div>
              <button type="button" className="secondary-button google-button" disabled aria-describedby="google-unavailable">
                <GoogleLogo />
                <span>Continue with Google</span>
              </button>
              <p id="google-unavailable" className="auth-social-note">Google sign-in is not available yet.</p>
            </div>}

            <p className="auth-switch">
              {isLogin ? "Don't have an account?" : 'Already have an account?'}{' '}
              <button type="button" disabled={isSubmitting || isSwitching} onClick={() => handleModeChange(isLogin ? 'register' : 'login')}>
                {isLogin ? 'Sign up' : 'Login'}
              </button>
            </p>
          </div>
        </section>
      </main>
      <AppFooter compact />
    </div>
  )
}

function ProtectedRoute({ user, children }: { user: User | null; children: ReactNode }) {
  if (!user) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

function DashboardScreen({ user, onLogout }: { user: User; onLogout: () => void }) {
  const navigate = useNavigate()
  const dashboardRef = useSectionReveal()
  const [companyName, setCompanyName] = useState('')
  const [searchMessage, setSearchMessage] = useState<{ type: 'error' | 'info'; text: string } | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const previousTitle = document.title
    document.title = 'Dashboard · Intro Finder'
    return () => { document.title = previousTitle }
  }, [])

  const handleLogout = () => {
    clearStoredToken()
    onLogout()
    navigate('/login', { replace: true })
  }

  const handleCompanySearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!companyName.trim()) {
      setSearchMessage({ type: 'error', text: 'Please enter a company name before searching.' })
      searchRef.current?.focus()
      return
    }
    navigate(`/find-introductions?company=${encodeURIComponent(companyName.trim())}`)
  }

  const openCompanySearch = (company?: string) => navigate(company ? `/find-introductions?company=${encodeURIComponent(company)}` : '/find-introductions')

  return (
    <div className="presentation-dashboard">
      <a className="presentation-skip-link" href="#overview">Skip to dashboard</a>
      <div className="presentation-frame">
        <DashboardHeader
          name={user.name}
          email={user.email}
          logo={<LogoMark compact />}
          onLogout={handleLogout}
          links={[
            { href: '#overview', label: 'Overview' },
            { href: '/find-introductions', label: 'Find introductions' },
            { href: '#momentum', label: 'Network activity' },
            { href: '#your-network', label: 'Your network' },
            { href: '#activity', label: 'Recent searches' },
            { href: '#network-paths', label: 'Introduction opportunities' },
            { href: '#discover', label: 'Your next move' },
            { href: '/history', label: 'Search history' },
            { href: '/settings', label: 'Settings' },
          ]}
        />
        <main className="presentation-main" ref={dashboardRef}>
          <OverviewSection />

          <section className="presentation-explore" id="explore" aria-labelledby="explore-heading" tabIndex={-1} data-reveal>
            <div className="presentation-explore-copy">
              <p className="presentation-eyebrow">02 / Find introductions</p>
              <h2 id="explore-heading">The right people.<br /><span>A warmer way in.</span></h2>
              <p>Explore a company and discover how your network could bring you closer to the people behind it.</p>
            </div>
            <div className="presentation-search-panel">
              <form className="presentation-search-form" onSubmit={handleCompanySearch} noValidate>
                <label htmlFor="company-search">Where would you like to go next?</label>
                <div className="presentation-search-input">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></svg>
                  <input
                    className="input"
                    id="company-search"
                    name="companyName"
                    ref={searchRef}
                    value={companyName}
                    onChange={(event) => { setCompanyName(event.target.value); setSearchMessage(null) }}
                    placeholder="Enter a company name"
                    aria-label="Company name"
                    aria-invalid={searchMessage?.type === 'error' || undefined}
                    aria-describedby={searchMessage ? 'company-search-feedback' : 'company-search-note'}
                  />
                </div>
                <button className="button button--primary presentation-primary-action" type="submit">Find introductions <span aria-hidden="true">↗</span></button>
              </form>
              <p className="presentation-data-note" id="company-search-note">Company discovery is not connected yet.</p>
              {searchMessage && <p id="company-search-feedback" className={`notice ${searchMessage.type === 'error' ? 'notice--error' : ''}`} role={searchMessage.type === 'error' ? 'alert' : 'status'}>{searchMessage.text}</p>}
            </div>
          </section>

          <MomentumSection />
          <NetworkSection />
          <RecentSearchesSection onSearch={() => openCompanySearch()} onRevisit={(search) => openCompanySearch(search.company.name)} />
          <ConnectionPathsSection onExplore={openCompanySearch} />
          <DiscoverySection onSearch={() => openCompanySearch()} />

        </main>
        <AppFooter backToTop="#overview" />
      </div>
    </div>
  )
}

function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [authReady, setAuthReady] = useState(() => !getStoredToken())
  useEffect(() => {
    const token = getStoredToken()

    if (!token) return

    fetch(`${API_BASE_URL}/me`, {
      headers: getAuthHeaders(token),
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error('Session invalid')
        }

        const data = await response.json()
        setCurrentUser(data.user)
      })
      .catch(() => {
        clearStoredToken()
        setCurrentUser(null)
      })
      .finally(() => {
        setAuthReady(true)
      })
  }, [])

  if (!authReady) {
    return (
      <div className="auth-shell">
        <div className="auth-card auth-loading-card">
          <div className="loading-state" role="status">Checking your session...</div>
        </div>
      </div>
    )
  }

  return (
    <BrowserRouter>
      <PageTransition>
      <Routes>
        <Route path="/" element={<Navigate to={currentUser ? '/dashboard' : '/login'} replace />} />
        <Route path="/about" element={<AboutProjectPage user={currentUser} logo={<LogoMark compact />} onLogout={() => { clearStoredToken(); setCurrentUser(null) }} />} />
        <Route
          path="/login"
          element={
            currentUser ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <AuthScreen onAuthenticated={setCurrentUser} />
            )
          }
        />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute user={currentUser}>
              <DashboardScreen
                user={currentUser!}
                onLogout={() => setCurrentUser(null)}
              />
            </ProtectedRoute>
          }
        />
        <Route
          path="/find-introductions"
          element={
            <ProtectedRoute user={currentUser}>
              <FindIntroductionsPage user={currentUser!} logo={<LogoMark compact />} onLogout={() => { clearStoredToken(); setCurrentUser(null) }} />
            </ProtectedRoute>
          }
        />
        <Route path="/history" element={<ProtectedRoute user={currentUser}><SearchHistoryPage user={currentUser!} logo={<LogoMark compact />} onLogout={() => { clearStoredToken(); setCurrentUser(null) }} /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute user={currentUser}><SettingsPage user={currentUser!} logo={<LogoMark compact />} onLogout={() => { clearStoredToken(); setCurrentUser(null) }} /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to={currentUser ? '/dashboard' : '/login'} replace />} />
      </Routes>
      </PageTransition>
    </BrowserRouter>
  )
}

export default App
