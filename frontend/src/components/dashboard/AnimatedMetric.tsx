import { useEffect, useRef } from 'react'

export function AnimatedMetric({ value }: { value: number }) {
  const valueRef = useRef<HTMLSpanElement>(null)
  const formatted = value.toLocaleString()

  useEffect(() => {
    const element = valueRef.current
    if (!element) return
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    let frame = 0
    const finish = () => {
      cancelAnimationFrame(frame)
      element.textContent = formatted
    }
    if (motion.matches || value <= 0 || !Number.isFinite(value) || typeof IntersectionObserver !== 'function') { finish(); return }

    let observer: IntersectionObserver
    try {
      observer = new IntersectionObserver((entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return
        observer.disconnect()
        const start = performance.now()
        const tick = (now: number) => {
          const progress = Math.min((now - start) / 720, 1)
          element.textContent = Math.round(value * (1 - (1 - progress) ** 3)).toLocaleString()
          if (progress < 1) frame = requestAnimationFrame(tick)
          else finish()
        }
        element.textContent = '0'
        frame = requestAnimationFrame(tick)
      }, { threshold: 0.6 })
      observer.observe(element)
    } catch { finish(); return }
    const onMotionChange = () => { if (motion.matches) { observer.disconnect(); finish() } }
    motion.addEventListener('change', onMotionChange)
    const onVisibilityChange = () => { if (document.hidden) { observer.disconnect(); finish() } }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => { observer.disconnect(); cancelAnimationFrame(frame); motion.removeEventListener('change', onMotionChange); document.removeEventListener('visibilitychange', onVisibilityChange) }
  }, [value, formatted])

  return <span className="motion-metric"><span className="sr-only">{formatted}</span><span className="motion-metric-size" aria-hidden="true">{formatted}</span><span aria-hidden="true" ref={valueRef}>{formatted}</span></span>
}
