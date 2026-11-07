import { useEffect, useRef } from 'react'

export function useSectionReveal() {
  const containerRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !containerRef.current) return
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('presentation-in-view')
          observer.unobserve(entry.target)
        }
      }
    }, { threshold: 0.08 })
    containerRef.current.querySelectorAll('[data-reveal]').forEach((section) => observer.observe(section))
    return () => observer.disconnect()
  }, [])

  return containerRef
}
