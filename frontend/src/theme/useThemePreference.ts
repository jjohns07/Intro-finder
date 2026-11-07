import { createContext, useContext } from 'react'

export type ThemePreference = 'dark' | 'light' | 'system'
export const ThemeContext = createContext<{
  preference: ThemePreference
  persistenceError: boolean
  setPreference: (theme: ThemePreference) => void
} | null>(null)

export function useThemePreference() {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('Theme preferences require ThemeProvider.')
  return context
}
