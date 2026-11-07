import type { ChangeEvent, ReactNode } from 'react'

type IconName = 'email' | 'lock' | 'person' | 'eye' | 'eye-off' | 'arrow'

export function AuthIcon({ name, className = '' }: { name: IconName; className?: string }) {
  const paths: Record<IconName, ReactNode> = {
    email: <><rect x="3" y="5" width="18" height="14" rx="3" /><path d="m4 7 8 6 8-6" /></>,
    lock: <><rect x="5" y="10" width="14" height="11" rx="3" /><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" /></>,
    person: <><circle cx="12" cy="8" r="4" /><path d="M4 21v-2a8 8 0 0 1 16 0v2" /></>,
    eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>,
    'eye-off': <><path d="m3 3 18 18M10.6 5.1 12 5c6.5 0 10 7 10 7a20 20 0 0 1-3 3.9M6.2 6.2A21 21 0 0 0 2 12s3.5 7 10 7c1.6 0 3-.4 4.3-1M10 10a3 3 0 0 0 4 4" /></>,
    arrow: <><path d="M4 12h16m-6-6 6 6-6 6" /></>,
  }
  return (
    <svg className={`auth-icon ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {paths[name]}
    </svg>
  )
}

type FieldProps = {
  id: string
  name: string
  label: string
  value: string
  onChange: (event: ChangeEvent<HTMLInputElement>) => void
  placeholder: string
  autoComplete: string
  error?: string
  hint?: string
}

function FieldFrame({ id, label, error, hint, children }: Pick<FieldProps, 'id' | 'label' | 'error' | 'hint'> & { children: ReactNode }) {
  return (
    <div className="field auth-field">
      <label htmlFor={id}>{label}</label>
      {children}
      {hint && <p className="auth-field-hint" id={`${id}-hint`}>{hint}</p>}
      {error && <p className="auth-field-error" id={`${id}-error`}>{error}</p>}
    </div>
  )
}

function descriptionIds({ id, error, hint }: Pick<FieldProps, 'id' | 'error' | 'hint'>) {
  return [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined
}

export function AuthInput({ type = 'text', icon, ...props }: FieldProps & { type?: 'text' | 'email'; icon: 'email' | 'person' }) {
  return (
    <FieldFrame {...props}>
      <div className="auth-input-wrap">
        <AuthIcon name={icon} className="auth-input-icon" />
        <input
          id={props.id}
          name={props.name}
          type={type}
          value={props.value}
          onChange={props.onChange}
          placeholder={props.placeholder}
          autoComplete={props.autoComplete}
          autoCapitalize={type === 'email' ? 'none' : 'words'}
          spellCheck={type === 'email' ? false : undefined}
          aria-invalid={!!props.error || undefined}
          aria-describedby={descriptionIds(props)}
          required
        />
      </div>
    </FieldFrame>
  )
}

export function PasswordField({ show, onToggle, ...props }: FieldProps & { show: boolean; onToggle: () => void }) {
  return (
    <FieldFrame {...props}>
      <div className="password-input-wrap auth-input-wrap">
        <AuthIcon name="lock" className="auth-input-icon" />
        <input
          id={props.id}
          type={show ? 'text' : 'password'}
          name={props.name}
          value={props.value}
          onChange={props.onChange}
          placeholder={props.placeholder}
          autoComplete={props.autoComplete}
          autoCapitalize="none"
          spellCheck={false}
          aria-invalid={!!props.error || undefined}
          aria-describedby={descriptionIds(props)}
          required
        />
        <button
          type="button"
          className="password-toggle"
          onClick={onToggle}
          aria-label={show ? `Hide ${props.label.toLowerCase()}` : `Show ${props.label.toLowerCase()}`}
          aria-pressed={show}
          aria-controls={props.id}
        >
          <AuthIcon name={show ? 'eye-off' : 'eye'} />
        </button>
      </div>
    </FieldFrame>
  )
}
