import { useLayoutEffect, useRef } from 'react'

export function useSectionReveal() {
  const containerRef = useRef<HTMLElement>(null)

  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container) return
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    let observer: IntersectionObserver | undefined
    const targets = new Set<Element>()
    const markStatic = (element: Element) => {
      element.setAttribute('data-motion-static', '')
      element.classList.add('presentation-in-view')
      observer?.unobserve(element)
      targets.delete(element)
    }
    try {
      if (typeof IntersectionObserver === 'function') {
        observer = new IntersectionObserver(entries => {
          for (const { target, isIntersecting } of entries) {
            if (!isIntersecting || !target.isConnected) continue
            if (motion.matches) markStatic(target)
            else target.classList.add('presentation-in-view')
            observer?.unobserve(target)
            targets.delete(target)
          }
        }, { threshold: 0.08 })
      }
    } catch { /* Static content is the fallback if observation is unavailable. */ }

    const visit = (root: Element, callback: (element: Element) => void) => {
      if (root.matches('[data-reveal]')) callback(root)
      root.querySelectorAll('[data-reveal]').forEach(callback)
    }
    const observe = (element: Element) => {
      if (motion.matches || !observer) { markStatic(element); return }
      if (element.classList.contains('presentation-in-view') || targets.has(element)) return
      targets.add(element)
      observer.observe(element)
    }
    visit(container, observe)
    // Only added/removed elements are scanned. Text changes (including counters)
    // and class changes never rescan the page or install scroll listeners.
    const mutations = typeof MutationObserver === 'function' ? new MutationObserver(records => {
      for (const record of records) {
        record.removedNodes.forEach(node => {
          if (node instanceof Element) visit(node, element => { observer?.unobserve(element); targets.delete(element) })
        })
        record.addedNodes.forEach(node => { if (node instanceof Element) visit(node, observe) })
      }
    }) : undefined
    mutations?.observe(container, { childList: true, subtree: true })
    const onPreferenceChange = () => {
      if (motion.matches) visit(container, markStatic)
      // Already revealed content never replays when motion is re-enabled.
    }
    motion.addEventListener('change', onPreferenceChange)
    return () => {
      observer?.disconnect()
      mutations?.disconnect()
      targets.clear()
      motion.removeEventListener('change', onPreferenceChange)
    }
  }, [])

  return containerRef
}
