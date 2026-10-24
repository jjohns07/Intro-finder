import { useEffect, useRef, useState, type ReactNode } from 'react'
import { BrowserRouter, Navigate,   Route, Routes, useNavigate } from 'react-router-dom'
import './App.css'

type AuthMode = 'login' | 'register'
type ThemeMode = 'light' | 'dark'

type User = {
  id: string
  name: string
  email: string
}

type AuthFormState = {
  name: string
  email: string
  company: string
  password: string
  confirmPassword: string
}

type StatusState = {
  type: 'success' | 'error'
  text: string
}

const API_BASE_URL = 'https://intro-finder-api.onrender.com/api/auth'
const TOKEN_STORAGE_KEY = 'introfinder_token'
const THEME_STORAGE_KEY = 'intro-finder-theme'

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

const featureHighlights = [
  'Track warm introductions from your network',
  'Prioritize outreach with context-rich contact data',
  'Collaborate on intros with your team and investors',
]

const initialFormState: AuthFormState = {
  name: '',
  email: '',
  company: '',
  password: '',
  confirmPassword: '',
}

function ThemeToggle({ theme, onToggle }: { theme: ThemeMode; onToggle: () => void }) {
  const isDark = theme === 'dark'

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={onToggle}
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      title={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
    >
      <span className="theme-toggle-track" aria-hidden="true">
        <span className="theme-toggle-thumb">{isDark ? '☾' : '☀'}</span>
      </span>
      <span className="theme-toggle-label">{isDark ? 'Dark' : 'Light'}</span>
    </button>
  )
}

function GoogleLogo() {
  return (
    <svg className="google-logo" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.22 3.61l6.87-6.87C35.71 2.57 30.43 0 24 0 14.64 0 6.5 5.38 2.54 13.22l8.05 6.25C12.5 14.56 17.72 9.5 24 9.5Z"
      />
      <path
        fill="#4285F4"
        d="M46.56 24.55c0-1.59-.14-3.12-.4-4.55H24v8.6h12.86c-.55 2.94-2.22 5.43-4.72 7.12l7.64 5.92C43.83 36.91 46.56 31.35 46.56 24.55Z"
      />
      <path
        fill="#FBBC05"
        d="M32.14 39.7c-2.59 1.73-5.89 2.75-8.14 2.75-6.29 0-11.62-4.19-13.51-9.81l-8.12 6.29C6.82 43.3 14.72 48 24 48c7.32 0 13.46-2.41 17.96-6.53l-9.82-1.77Z"
      />
      <path
        fill="#34A853"
        d="M10.49 32.64A14.15 14.15 0 0 1 9.5 24c0-1.57.27-3.08.75-4.52L2.54 13.22A23.52 23.52 0 0 0 0 24c0 3.8.91 7.4 2.54 10.57l7.95-6.29Z"
      />
    </svg>
  )
}

function LogoMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`brand-mark ${compact ? 'compact' : ''}`} aria-label="Intro Finder logo">
      <svg viewBox="0 0 52 52" role="img" aria-hidden="true" focusable="false">
        <circle cx="19" cy="25" r="8.5" fill="none" stroke="currentColor" strokeWidth="2.8" />
        <path d="M27.4 22.9c3.5 0 6.6 2.8 7 6.3l1.7 8.1c.2 1.6-1 3-2.6 3H18.5c-1.6 0-2.8-1.4-2.6-3l1.7-8.1c.4-3.5 3.5-6.3 7-6.3Z" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinejoin="round" />
        <path d="M30.5 12.5a6 6 0 0 1 8.2 8.3M38.5 15l-8 8.3" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
        <path d="M41.5 19.5 46.5 15" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
      </svg>
    </div>
  )
}

function TypewriterHeadline({
  text,
  as: Component = 'h1',
  className = '',
  once = true,
}: {
  text: string
  as?: 'h1' | 'h2'
  className?: string
  once?: boolean
}) {
  const containerRef = useRef<HTMLHeadingElement | null>(null)
  const hasStartedRef = useRef(false)
  const [visible, setVisible] = useState(false)
  const [displayedText, setDisplayedText] = useState('')

  useEffect(() => {
    const element = containerRef.current

    if (!element || !once) {
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (entry?.isIntersecting) {
          setVisible(true)
          if (!hasStartedRef.current) {
            hasStartedRef.current = true
          }
        }
      },
      { threshold: 0.3 },
    )

    observer.observe(element)
    return () => observer.disconnect()
  }, [once])

  useEffect(() => {
    if (!visible) {
      return
    }

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (prefersReducedMotion) {
      setDisplayedText(text)
      return
    }

    let index = 0
    const timer = window.setInterval(() => {
      index += 1
      setDisplayedText(text.slice(0, index))

      if (index >= text.length) {
        window.clearInterval(timer)
      }
    }, 42)

    return () => window.clearInterval(timer)
  }, [text, visible])

  const isComplete = displayedText.length >= text.length

  return (
    <Component ref={containerRef} className={className} aria-label={text}>
      {displayedText}
      {!isComplete && visible && <span className="typewriter-caret" aria-hidden="true" />}
    </Component>
  )
}

function AnimatedStat({ value, label, suffix = '' }: { value: number; label: string; suffix?: string }) {
  const [displayValue, setDisplayValue] = useState(0)
  const statRef = useRef<HTMLDivElement | null>(null)
  const hasAnimatedRef = useRef(false)

  useEffect(() => {
    const element = statRef.current

    if (!element) {
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]

        if (!entry?.isIntersecting || hasAnimatedRef.current) {
          return
        }

        hasAnimatedRef.current = true
        const startTime = performance.now()
        const duration = 1200

        const update = (time: number) => {
          const progress = Math.min((time - startTime) / duration, 1)
          const eased = 1 - (1 - progress) ** 3
          setDisplayValue(Math.round(value * eased))

          if (progress < 1) {
            requestAnimationFrame(update)
          }
        }

        requestAnimationFrame(update)
      },
      { threshold: 0.35 },
    )

    observer.observe(element)
    return () => observer.disconnect()
  }, [value])

  return (
    <div className="stat-box" ref={statRef}>
      <span>
        {displayValue}
        {suffix}
      </span>
      <small>{label}</small>
    </div>
  )
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  placeholder,
  autoComplete,
  name,
  show,
  onToggle,
}: {
  id: string
  label: string
  value: string
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void
  placeholder: string
  autoComplete: string
  name: string
  show: boolean
  onToggle: () => void
}) {
  return (
    <label className="field" htmlFor={id}>
      <span>{label}</span>
      <div className="password-input-wrap">
        <input
          id={id}
          type={show ? 'text' : 'password'}
          name={name}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete={autoComplete}
        />
        <button
          type="button"
          className="password-toggle"
          onClick={onToggle}
          aria-label={show ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          aria-pressed={show}
        >
          {show ? (
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M2.5 12S6.1 5.5 12 5.5 21.5 12 21.5 12 17.9 18.5 12 18.5 2.5 12 2.5 12Zm9.5 3.5A3.5 3.5 0 1 0 12 8.5a3.5 3.5 0 0 0 0 7Z" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M3 3.5 20.5 21l-1 1-3.32-3.32A12.8 12.8 0 0 1 12 18.5C6.1 18.5 2.5 12 2.5 12a13.1 13.1 0 0 1 5.2-5.8L4 4.5 3 3.5Zm9 2.42A9.6 9.6 0 0 1 17.5 12c-.5.9-1.2 1.7-2 2.4L14.4 13a3.5 3.5 0 0 1-5.2-4.1L8.8 8.3c.8-.4 1.7-.6 2.7-.6Zm-1.3 6.35L13.3 14a2.5 2.5 0 0 1-3.1-3.1Zm6.5-5.1L16.9 8a9.7 9.7 0 0 1 2.8 4.1c-.8 1.2-1.9 2.3-3.2 3.1l-1.2-1.2a8.4 8.4 0 0 0 2.3-2.5 8.7 8.7 0 0 0-2.9-3.3Z" />
            </svg>
          )}
        </button>
      </div>
    </label>
  )
}

function AuthScreen({
  onAuthenticated,
  theme,
  onToggleTheme,
}: {
  onAuthenticated: (user: User) => void
  theme: ThemeMode
  onToggleTheme: () => void
}) {
  const navigate = useNavigate()
  const [mode, setMode] = useState<AuthMode>('login')
  const [formData, setFormData] = useState<AuthFormState>(initialFormState)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [status, setStatus] = useState<StatusState | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const isLogin = mode === 'login'

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target
    setFormData((current) => ({ ...current, [name]: value }))
  }

  const handleModeChange = (nextMode: AuthMode) => {
    setMode(nextMode)
    setStatus(null)
    setShowPassword(false)
    setShowConfirmPassword(false)
    setFormData(initialFormState)
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setStatus(null)

    const email = formData.email.trim()
    const password = formData.password

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setStatus({ type: 'error', text: 'Please enter a valid email address.' })
      return
    }

    if (!password || password.length < 8) {
      setStatus({ type: 'error', text: 'Password must be at least 8 characters long.' })
      return
    }

    if (!isLogin) {
      const name = formData.name.trim()

      if (name.length < 2) {
        setStatus({ type: 'error', text: 'Name must be at least 2 characters long.' })
        return
      }

      if (formData.password !== formData.confirmPassword) {
        setStatus({ type: 'error', text: 'Passwords do not match.' })
        return
      }
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
    <div className="auth-shell">
      <div className="auth-card">
        <aside className="auth-brand-panel" aria-label="Intro Finder overview">
          <div className="brand-header-row">
            <div className="brand-header">
              <LogoMark />
              <div className="brand-copy">
                <strong>Intro Finder</strong>
                <span>Warm intros, smarter</span>
              </div>
            </div>
          </div>

          <div className="eyebrow">Private network</div>
          <TypewriterHeadline as="h1" className="brand-headline" text="Find warm paths to the right people" />
          <p className="brand-description">
            Use your professional network to unlock thoughtful introductions and move faster
            with the right context.
          </p>

          <ul className="feature-list">
            {featureHighlights.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>

          <div className="brand-stats">
            <AnimatedStat value={24} label="warm leads" />
            <AnimatedStat value={92} label="response rate" suffix="%" />
          </div>
        </aside>

        <main className="auth-form-panel">
          <div className="auth-toolbar">
            <div className="auth-mode-switch" role="tablist" aria-label="Authentication mode">
              <button
                type="button"
                role="tab"
                aria-selected={isLogin}
                className={isLogin ? 'active' : ''}
                onClick={() => handleModeChange('login')}
              >
                Login
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={!isLogin}
                className={!isLogin ? 'active' : ''}
                onClick={() => handleModeChange('register')}
              >
                Register
              </button>
            </div>
            <ThemeToggle theme={theme} onToggle={onToggleTheme} />
          </div>

          <div className="form-heading">
            <h2>{isLogin ? 'Welcome back' : 'Create your account'}</h2>
            <p>
              {isLogin
                ? 'Sign in to continue your intro workflow.'
                : 'Set up a secure profile to start finding warm connections.'}
            </p>
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            {!isLogin && (
              <label className="field">
                <span>Full name</span>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Alex Lee"
                  autoComplete="name"
                />
              </label>
            )}

            <label className="field">
              <span>Email address</span>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="you@example.com"
                autoComplete="email"
              />
            </label>

            {!isLogin && (
              <label className="field">
                <span>Company</span>
                <input
                  type="text"
                  name="company"
                  value={formData.company}
                  onChange={handleChange}
                  placeholder="Northstar Capital"
                  autoComplete="organization"
                />
              </label>
            )}

            <PasswordField
              id="password"
              label="Password"
              value={formData.password}
              onChange={handleChange}
              placeholder="••••••••"
              autoComplete={isLogin ? 'current-password' : 'new-password'}
              name="password"
              show={showPassword}
              onToggle={() => setShowPassword((current) => !current)}
            />

            {!isLogin && (
              <PasswordField
                id="confirmPassword"
                label="Confirm password"
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder="Repeat your password"
                autoComplete="new-password"
                name="confirmPassword"
                show={showConfirmPassword}
                onToggle={() => setShowConfirmPassword((current) => !current)}
              />
            )}

            {isLogin && (
              <div className="inline-links">
                <label className="remember-me">
                  <input type="checkbox" />
                  <span>Remember me</span>
                </label>
                <button type="button" className="text-link">
                  Forgot password?
                </button>
              </div>
            )}

            {status && (
              <div className={`form-status ${status.type}`} aria-live="polite">
                {status.text}
              </div>
            )}

            <button type="submit" className="primary-button" disabled={isSubmitting}>
              {isSubmitting ? (isLogin ? 'Signing in...' : 'Creating account...') : isLogin ? 'Sign in to dashboard' : 'Create account'}
            </button>
          </form>

          <div className="divider">
            <span>or continue with</span>
          </div>

          <button type="button" className="secondary-button google-button">
            <GoogleLogo />
            <span>Continue with Google</span>
          </button>

          <p className="auth-switch">
            {isLogin ? 'Need an account?' : 'Already have an account?'}{' '}
            <button type="button" onClick={() => handleModeChange(isLogin ? 'register' : 'login')}>
              {isLogin ? 'Create one' : 'Sign in'}
            </button>
          </p>
        </main>
      </div>
    </div>
  )
}

function ProtectedRoute({ user, children }: { user: User | null; children: ReactNode }) {
  if (!user) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

function DashboardScreen({
  user,
  onLogout,
  theme,
  onToggleTheme,
}: {
  user: User
  onLogout: () => void
  theme: ThemeMode
  onToggleTheme: () => void
}) {
  const navigate = useNavigate()
  const [companyName, setCompanyName] = useState('')
  const [searchMessage, setSearchMessage] = useState<{ type: 'error' | 'info'; text: string } | null>(null)

  const handleLogout = () => {
    clearStoredToken()
    onLogout()
    navigate('/login', { replace: true })
  }

  const handleCompanySearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const trimmedCompany = companyName.trim()

    if (!trimmedCompany) {
      setSearchMessage({
        type: 'error',
        text: 'Please enter a company name before searching.',
      })
      return
    }

    setSearchMessage({
      type: 'info',
      text: 'Company discovery is not connected yet. Please try again once the search API is available.',
    })
  }

  const focusCompanySearch = () => {
    const input = document.getElementById('company-search') as HTMLInputElement | null

    if (!input) {
      return
    }

    input.focus()
    input.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  const navItems = ['Dashboard', 'Find Introductions', 'Search History', 'Settings']

  return (
    <div className="dashboard-shell">
      <div className="dashboard-layout">
        <aside className="dashboard-sidebar" aria-label="Main navigation">
          <div className="sidebar-brand">
            <LogoMark compact />
            <div className="brand-copy">
              <strong>Intro Finder</strong>
            </div>
          </div>

          <nav className="sidebar-nav" aria-label="Sidebar navigation">
            {navItems.map((item) => (
              <button
                key={item}
                type="button"
                className={`nav-item ${item === 'Dashboard' ? 'active' : ''}`}
                aria-current={item === 'Dashboard' ? 'page' : undefined}
              >
                {item}
              </button>
            ))}
          </nav>
        </aside>

        <div className="dashboard-content">
          <header className="dashboard-topbar">
            <div className="topbar-title-wrap">
              <p className="topbar-kicker">Overview</p>
              <h1>Dashboard</h1>
            </div>

            <div className="user-actions">
              <ThemeToggle theme={theme} onToggle={onToggleTheme} />
              <div className="user-profile" aria-label="Current user profile">
                <div className="user-avatar">{user.name.charAt(0).toUpperCase()}</div>
                <div className="user-meta">
                  <span>{user.name}</span>
                  <small>{user.email}</small>
                </div>
              </div>

              <button type="button" className="logout-button" onClick={handleLogout}>
                Logout
              </button>
            </div>
          </header>

          <main className="dashboard-main">
            <section className="dashboard-hero" aria-labelledby="dashboard-heading">
              <span className="eyebrow eyebrow-light">Private network</span>
              <TypewriterHeadline as="h2" className="dashboard-headline" text="Find warm paths to the right people" />
              <p>
                Discover potential introduction paths to company founders through your professional
                connections, uncover trusted contacts, and move your outreach forward with greater
                context.
              </p>

              <form className="company-search-form" onSubmit={handleCompanySearch} noValidate>
                <label className="company-search-label" htmlFor="company-search">
                  Company name
                </label>

                <div className="company-search-row">
                  <div className="company-search-input-wrap">
                    <svg
                      className="company-search-icon"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                      focusable="false"
                    >
                      <path d="M10.5 3a7.5 7.5 0 0 1 5.88 12.8l4.42 4.42 1.41-1.41-4.42-4.42A7.5 7.5 0 1 1 10.5 3Zm0 2a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11Z" />
                    </svg>
                    <input
                      id="company-search"
                      type="text"
                      name="companyName"
                      value={companyName}
                      onChange={(event) => {
                        setCompanyName(event.target.value)
                        if (searchMessage) {
                          setSearchMessage(null)
                        }
                      }}
                      placeholder="Enter a company name..."
                      aria-label="Company name"
                      aria-invalid={searchMessage?.type === 'error'}
                    />
                  </div>

                  <button type="submit" className="primary-search-button">
                    <span>Find introductions</span>
                  </button>
                </div>
              </form>

              {searchMessage && (
                <p className={`search-status ${searchMessage.type}`} role="status" aria-live="polite">
                  {searchMessage.text}
                </p>
              )}
            </section>

            <section className="dashboard-support-grid" aria-label="Dashboard support cards">
              <article className="support-card">
                <div className="card-header">
                  <div className="card-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" focusable="false">
                      <path d="M10.5 3a7.5 7.5 0 0 1 5.88 12.8l4.42 4.42 1.41-1.41-4.42-4.42A7.5 7.5 0 1 1 10.5 3Zm0 2a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11Z" />
                    </svg>
                  </div>
                  <div>
                    <p className="card-kicker">Search history</p>
                    <h3>Recent activity</h3>
                  </div>
                </div>

                <div className="empty-state">
                  <div className="empty-state-illustration" aria-hidden="true">
                    <span>⌕</span>
                  </div>
                  <p>No search history yet.</p>
                  <small>Search for a company to see your recent lookups here.</small>
                </div>

                <button type="button" className="support-cta" onClick={focusCompanySearch}>
                  Start a company search
                </button>
              </article>

              <article className="support-card">
                <div className="card-header">
                  <div className="card-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" focusable="false">
                      <path d="M7 4.75A2.75 2.75 0 0 1 9.75 2h4.5A2.75 2.75 0 0 1 17 4.75V6h1.5A2.5 2.5 0 0 1 21 8.5v10A2.5 2.5 0 0 1 18.5 21h-13A2.5 2.5 0 0 1 3 18.5v-10A2.5 2.5 0 0 1 5.5 6H7V4.75Zm2 1.25h6V6H9V6Zm-3.5 2.75v9.5c0 .28.22.5.5.5h13a.5.5 0 0 0 .5-.5v-9.5H5.5Z" />
                    </svg>
                  </div>
                  <div>
                    <p className="card-kicker">Saved companies</p>
                    <h3>Followed targets</h3>
                  </div>
                </div>

                <div className="empty-state">
                  <div className="empty-state-illustration" aria-hidden="true">
                    <span>★</span>
                  </div>
                  <p>No saved companies yet.</p>
                  <small>Save promising companies as you explore your network.</small>
                </div>

                <button type="button" className="support-cta subtle" onClick={focusCompanySearch}>
                  Search for a company
                </button>
              </article>

              <article className="support-card">
                <div className="card-header">
                  <div className="card-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" focusable="false">
                      <path d="M9.5 11.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5Zm-4.5 8c.3-2.5 2.2-4.5 5.1-4.5s4.8 2 5.1 4.5H5Zm11.5-7.2a2.2 2.2 0 1 1 0-4.4 2.2 2.2 0 0 1 0 4.4Zm3 7.4c-.2-1.9-1.5-3.4-3.8-4a3.8 3.8 0 0 0 .9-2.4A3.9 3.9 0 0 0 13 6.3 3.9 3.9 0 0 0 9.1 10a3.8 3.8 0 0 0 1 2.4c-2.3.6-3.6 2.1-3.8 4H3v1.5h18V19h-1.5Z" />
                    </svg>
                  </div>
                  <div>
                    <p className="card-kicker">Introductions</p>
                    <h3>Warm connections</h3>
                  </div>
                </div>

                <div className="empty-state">
                  <div className="empty-state-illustration" aria-hidden="true">
                    <span>◎</span>
                  </div>
                  <p>No introductions yet.</p>
                  <small>When a path opens up, your strongest opportunities will appear here.</small>
                </div>

                <button type="button" className="support-cta subtle" onClick={focusCompanySearch}>
                  Find likely targets
                </button>
              </article>
            </section>
          </main>
        </div>
      </div>
    </div>
  )
}

function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [theme, setTheme] = useState<ThemeMode>(() => {
    if (typeof window === 'undefined') {
      return 'light'
    }

    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY)

    if (storedTheme === 'light' || storedTheme === 'dark') {
      return storedTheme
    }

    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    document.documentElement.classList.toggle('dark', theme === 'dark')
    window.localStorage.setItem(THEME_STORAGE_KEY, theme)
  }, [theme])

  useEffect(() => {
    const token = getStoredToken()

    if (!token) {
      setAuthReady(true)
      return
    }

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

  const handleThemeToggle = () => {
    setTheme((currentTheme) => (currentTheme === 'dark' ? 'light' : 'dark'))
  }

  if (!authReady) {
    return (
      <div className="auth-shell">
        <div className="auth-card auth-loading-card">
          <div className="loading-state">Checking your session...</div>
        </div>
      </div>
    )
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to={currentUser ? '/dashboard' : '/login'} replace />} />
        <Route
          path="/login"
          element={
            currentUser ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <AuthScreen onAuthenticated={setCurrentUser} theme={theme} onToggleTheme={handleThemeToggle} />
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
                theme={theme}
                onToggleTheme={handleThemeToggle}
              />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to={currentUser ? '/dashboard' : '/login'} replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
