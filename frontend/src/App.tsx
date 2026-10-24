import { useEffect, useState, type ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import './App.css'

type AuthMode = 'login' | 'register'

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

const getStoredToken = (): string | null => sessionStorage.getItem(TOKEN_STORAGE_KEY)

const setStoredToken = (token: string): void => {
  sessionStorage.setItem(TOKEN_STORAGE_KEY, token)
}

const clearStoredToken = (): void => {
  sessionStorage.removeItem(TOKEN_STORAGE_KEY)
}

const getAuthHeaders = (tokenOverride?: string | null): HeadersInit => {
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

function AuthScreen({ onAuthenticated }: { onAuthenticated: (user: User) => void }) {
  const navigate = useNavigate()
  const [mode, setMode] = useState<AuthMode>('login')
  const [formData, setFormData] = useState<AuthFormState>(initialFormState)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [status, setStatus] = useState<StatusState | null>(null)

  const isLogin = mode === 'login'

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target
    setFormData((current) => ({ ...current, [name]: value }))
  }

  const handleModeChange = (nextMode: AuthMode) => {
    setMode(nextMode)
    setStatus(null)
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
          <div className="brand-header">
            <div className="brand-mark">IF</div>
            <div className="brand-copy">
              <strong>Intro Finder</strong>
              <span>Warm intros, smarter</span>
            </div>
          </div>

          <div className="eyebrow">Private network</div>
          <h1>Find warm paths to the right people.</h1>
          <p>
            Use your professional network to unlock thoughtful introductions and move faster
            with the right context.
          </p>

          <ul className="feature-list">
            {featureHighlights.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>

          <div className="brand-stats">
            <div className="stat-box">
              <span>24</span>
              <small>warm leads</small>
            </div>
            <div className="stat-box">
              <span>92%</span>
              <small>response rate</small>
            </div>
          </div>
        </aside>

        <main className="auth-form-panel">
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
              <label>
                <span>Full name</span>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Alex Lee"
                />
              </label>
            )}

            <label>
              <span>Email address</span>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="you@example.com"
              />
            </label>

            {!isLogin && (
              <label>
                <span>Company</span>
                <input
                  type="text"
                  name="company"
                  value={formData.company}
                  onChange={handleChange}
                  placeholder="Northstar Capital"
                />
              </label>
            )}

            <label>
              <span>Password</span>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="••••••••"
              />
            </label>

            {!isLogin && (
              <label>
                <span>Confirm password</span>
                <input
                  type="password"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  placeholder="Repeat your password"
                />
              </label>
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

          <button type="button" className="secondary-button">
            Continue with Google
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

function DashboardScreen({ user, onLogout }: { user: User; onLogout: () => void }) {
  const navigate = useNavigate()
  const [companyName, setCompanyName] = useState('')
  const [searchMessage, setSearchMessage] = useState<{ type: 'error' | 'info'; text: string } | null>(
    null,
  )

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
            <div className="brand-mark">IF</div>
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
              <h2 id="dashboard-heading">Find your way to the right people.</h2>
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
          element={currentUser ? <Navigate to="/dashboard" replace /> : <AuthScreen onAuthenticated={setCurrentUser} />}
        />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute user={currentUser}>
              <DashboardScreen user={currentUser!} onLogout={() => setCurrentUser(null)} />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to={currentUser ? '/dashboard' : '/login'} replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
