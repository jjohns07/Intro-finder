import { useEffect, useRef, useState, type ReactNode } from 'react'
import { BrowserRouter, Navigate,   Route, Routes, useNavigate } from 'react-router-dom'
import './App.css'
import './styles/auth.css'
import architecturePhoto from './assets/auth-entrance.jpg'
import { AuthIcon, AuthInput, PasswordField } from './components/AuthFields'

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

const initialFormState: AuthFormState = {
  name: '',
  email: '',
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
  const isLogin = mode === 'login'

  useEffect(() => () => window.clearTimeout(switchTimer.current), [])

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target
    setFormData((current) => ({ ...current, [name]: value }))
    setErrors((current) => ({ ...current, [name]: undefined }))
    setStatus(null)
  }

  const handleModeChange = (nextMode: AuthMode) => {
    if (isSubmitting || isSwitching || nextMode === mode) return

    const finishSwitch = () => {
      setMode(nextMode)
      setStatus(null)
      setErrors({})
      setShowPassword(false)
      setShowConfirmPassword(false)
      setFormData(initialFormState)
      setIsSwitching(false)
      requestAnimationFrame(() => headingRef.current?.focus({ preventScroll: true }))
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

      <main className="auth-stage">
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
