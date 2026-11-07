import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'

export function PageTransition({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  const rootRef = useRef<HTMLDivElement>(null)
  const previousPath = useRef(pathname)

  useLayoutEffect(() => {
    if (previousPath.current === pathname) return
    previousPath.current = pathname
    const element = rootRef.current
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (motion.matches || !element?.animate) return
    let animation: Animation | undefined
    try {
      // Animate the incoming page only: routing and authentication happen at
      // once, and no obsolete page remains clickable behind an exit overlay.
      animation = element.animate([{ opacity: .72 }, { opacity: 1 }], {
        duration: 180, easing: 'cubic-bezier(0.2, 0, 0, 1)',
      })
    } catch { /* Navigation still works without Web Animations. */ }
    const finish = () => { if (motion.matches) animation?.cancel() }
    motion.addEventListener('change', finish)
    return () => { animation?.cancel(); motion.removeEventListener('change', finish) }
  }, [pathname])

  return <div ref={rootRef} className="motion-route">{children}</div>
}
