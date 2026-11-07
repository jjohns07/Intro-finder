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
    if (motion.matches || value === 0) { finish(); return }

    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return
      observer.disconnect()
      const start = performance.now()
      const tick = (now: number) => {
        const progress = Math.min((now - start) / 850, 1)
        element.textContent = Math.round(value * (1 - (1 - progress) ** 3)).toLocaleString()
        if (progress < 1) frame = requestAnimationFrame(tick)
        else finish()
      }
      element.textContent = '0'
      frame = requestAnimationFrame(tick)
    }, { threshold: 0.6 })
    observer.observe(element)
    const onMotionChange = () => { if (motion.matches) { observer.disconnect(); finish() } }
    motion.addEventListener('change', onMotionChange)
    return () => { observer.disconnect(); cancelAnimationFrame(frame); motion.removeEventListener('change', onMotionChange) }
  }, [value, formatted])

  return <span aria-label={formatted}><span aria-hidden="true" ref={valueRef}>{formatted}</span></span>
}
