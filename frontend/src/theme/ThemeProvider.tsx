import { useEffect, useState, type ReactNode } from 'react'
import { ThemeContext, type ThemePreference } from './useThemePreference'

const storageKey = 'introfinder_theme'
const mediaQuery = '(prefers-color-scheme: dark)'
const isTheme = (value: unknown): value is ThemePreference => value === 'dark' || value === 'light' || value === 'system'

function readPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(storageKey)
    return isTheme(stored) ? stored : 'dark'
  } catch {
    return 'dark'
  }
}

function applyTheme(theme: ThemePreference) {
  const resolved = theme === 'system' ? window.matchMedia(mediaQuery).matches ? 'dark' : 'light' : theme
  document.documentElement.dataset.theme = resolved
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', resolved === 'dark' ? '#101014' : '#f5f4f1')
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setTheme] = useState<ThemePreference>(readPreference)
  const [persistenceError, setPersistenceError] = useState(false)

  useEffect(() => {
    applyTheme(preference)
    const media = window.matchMedia(mediaQuery)
    const syncSystem = () => { if (preference === 'system') applyTheme('system') }
    media.addEventListener('change', syncSystem)
    return () => media.removeEventListener('change', syncSystem)
  }, [preference])

  useEffect(() => {
    const syncStorage = (event: StorageEvent) => {
      if (event.storageArea !== localStorage || (event.key !== storageKey && event.key !== null)) return
      const next = isTheme(event.newValue) ? event.newValue : 'dark'
      applyTheme(next)
      setTheme(next)
      setPersistenceError(false)
    }
    window.addEventListener('storage', syncStorage)
    return () => window.removeEventListener('storage', syncStorage)
  }, [])

  const setPreference = (theme: ThemePreference) => {
    applyTheme(theme)
    setTheme(theme)
    try {
      localStorage.setItem(storageKey, theme)
      setPersistenceError(false)
    } catch {
      setPersistenceError(true)
    }
  }

  return <ThemeContext.Provider value={{ preference, persistenceError, setPreference }}>{children}</ThemeContext.Provider>
}

