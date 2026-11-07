import { useEffect, useState, type HTMLAttributes, type ReactNode } from 'react'

type Props = Omit<HTMLAttributes<HTMLElement>, 'children'> & {
  open: boolean
  as?: 'div' | 'section' | 'nav'
  children: ReactNode
}

// Closing overlays become inert immediately. Their short visual exit never
// delays navigation or leaves invisible controls in the focus order.
export function MotionPresence({ open, as: Tag = 'div', children, className = '', ...props }: Props) {
  const [mounted, setMounted] = useState(open)
  if (open && !mounted) setMounted(true)

  useEffect(() => {
    if (open || !mounted) return
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const timer = window.setTimeout(() => setMounted(false), motion.matches ? 0 : 140)
    const finish = () => { if (motion.matches) setMounted(false) }
    motion.addEventListener('change', finish)
    return () => { window.clearTimeout(timer); motion.removeEventListener('change', finish) }
  }, [open, mounted])

  if (!mounted) return null
  return <Tag {...props} className={`motion-presence ${className}`} data-exiting={!open || undefined} aria-hidden={!open || undefined} inert={!open || undefined}>{children}</Tag>
}
