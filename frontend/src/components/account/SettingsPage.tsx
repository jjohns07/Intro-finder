import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useThemePreference, type ThemePreference } from '../../theme/useThemePreference'
import { useSectionReveal } from '../dashboard/useSectionReveal'
import { AccountPageLayout, type AccountPageProps } from './AccountPageLayout'
import { WordReveal } from '../motion/WordReveal'

const themes: { value: ThemePreference; label: string; description: string }[] = [
  { value: 'dark', label: 'After hours', description: 'Dark · Our signature charcoal palette' },
  { value: 'light', label: 'Daylight', description: 'Light · A softer, brighter perspective' },
  { value: 'system', label: 'In sync', description: 'System · Follow your device’s appearance' },
]

export function SettingsPage(props: AccountPageProps) {
  const { user, onLogout } = props
  const { preference, setPreference, persistenceError } = useThemePreference()
  const [themeChanged, setThemeChanged] = useState(false)
  const revealRef = useSectionReveal()
  const initials = user.name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase()
  return <AccountPageLayout {...props} title="Settings">
    <main className="account-main settings-main" id="account-page-content" tabIndex={-1} ref={revealRef}>
      <header className="account-hero" data-reveal="hero"><p className="presentation-eyebrow"><span /> A space that feels like you</p><h1 data-motion-text="words"><WordReveal text="Your account." /><br /><span><WordReveal text="Your preferences." start={2} /></span></h1><p>The essentials, thoughtfully arranged. Make Intro Finder feel at home.</p></header>
      <nav className="settings-section-links" aria-label="Settings sections"><a href="#account">Account</a><a href="#appearance">Appearance</a><a href="#platforms">Connected platforms</a><a href="#security">Security</a></nav>

      <section className="settings-section" id="account" tabIndex={-1} aria-labelledby="account-heading" data-reveal>
        <div className="settings-section-copy"><p className="presentation-eyebrow">01 / The essentials</p><h2 id="account-heading">Account</h2><p>The person behind every new possibility.</p></div>
        <div className="settings-account-panel"><div className="settings-identity"><span className="settings-avatar" aria-hidden="true">{initials || 'I'}</span><div><h3>{user.name}</h3><span className="account-signed-in"><i aria-hidden="true" /> Signed in</span></div></div><dl className="settings-account-fields"><div><dt>Full name</dt><dd>{user.name}</dd></div><div><dt>Email address</dt><dd>{user.email}</dd></div></dl><p className="settings-availability">Your account details are shown above. Profile editing is not available yet.</p></div>
      </section>

      <section className="settings-section" id="appearance" tabIndex={-1} aria-labelledby="appearance-heading" data-reveal>
        <div className="settings-section-copy"><p className="presentation-eyebrow">02 / Set the mood</p><h2 id="appearance-heading">Appearance</h2><p>A different light.<br />The same possibilities.</p></div>
        <div><fieldset className="theme-options"><legend className="sr-only">Choose your theme</legend>{themes.map(theme => <label key={theme.value} className="theme-option" data-selected={preference === theme.value}>
          <input type="radio" name="theme" value={theme.value} checked={preference === theme.value} aria-label={`${theme.value === 'system' ? 'System' : theme.value === 'dark' ? 'Dark' : 'Light'} theme`} onChange={() => { setPreference(theme.value); setThemeChanged(true) }} />
          <span className={`theme-preview theme-preview--${theme.value}`} aria-hidden="true"><i /><span /><b /><em /></span>
          <span className="theme-option-title">{theme.label}<span className="theme-selected" aria-hidden="true">{preference === theme.value ? '✓' : ''}</span></span><span className="theme-option-description">{theme.description}</span>
        </label>)}</fieldset><p className="settings-availability">Applies throughout Intro Finder, including the login page. Saved in this browser.</p><p className={`theme-save-feedback ${persistenceError ? 'theme-save-error' : ''}`} role="status" aria-live="polite">{persistenceError ? 'Theme applied, but your browser could not save it. It may reset when you reload.' : themeChanged ? 'Appearance preference saved.' : ''}</p>{persistenceError && <button className="presentation-inline-action" type="button" onClick={() => { setPreference(preference); setThemeChanged(true) }}>Retry saving preference <span aria-hidden="true">↻</span></button>}</div>
      </section>

      <section className="settings-section" id="platforms" tabIndex={-1} aria-labelledby="platforms-heading" data-reveal>
        <div className="settings-section-copy"><p className="presentation-eyebrow">03 / Your wider world</p><h2 id="platforms-heading">Connected<br /> platforms</h2><p>A clear view of the places your network could come together.</p></div>
        <div className="settings-platforms"><p className="settings-platform-intro">No social platforms are configured for Intro Finder yet.</p><ul>{[{ name: 'LinkedIn', mark: 'in' }, { name: 'X', mark: '𝕏' }, { name: 'Google', mark: 'G' }].map(platform => <li key={platform.name}><span className={`settings-platform-mark settings-platform-mark--${platform.name.toLowerCase()}`} aria-hidden="true">{platform.mark}</span><div><h3>{platform.name}</h3><p>{platform.name === 'Google' ? 'Social sign-in' : 'Network discovery'}</p></div><span className="settings-platform-status">Not configured</span></li>)}</ul><p className="settings-availability">Connection actions will appear when an integration is available.</p></div>
      </section>

      <section className="settings-section settings-security" id="security" tabIndex={-1} aria-labelledby="security-heading" data-reveal>
        <div className="settings-section-copy"><p className="presentation-eyebrow">04 / Peace of mind</p><h2 id="security-heading">Security</h2><p>Know where you stand.<br />Stay in control.</p></div>
        <div className="settings-security-content"><div className="settings-session"><div><span className="account-signed-in"><i aria-hidden="true" /> Current session</span><h3>You’re signed in here.</h3><p>Sign out of Intro Finder in this browser tab.</p></div><button className="button button--secondary" type="button" onClick={onLogout}>Sign out <span aria-hidden="true">↗</span></button></div><div className="settings-security-notes"><div><h3>Password</h3><p>Password changes and resets are not available yet.</p></div><div><h3>Other sessions</h3><p>Device history and signing out of other sessions are not available.</p></div></div></div>
      </section>
      <div className="settings-closing"><p>All set for your next connection.</p><Link className="presentation-inline-action" to="/find-introductions">Keep exploring <span aria-hidden="true">↗</span></Link></div>
    </main>
  </AccountPageLayout>
}
