import type { RequestHandler } from 'express'
import type { AuthenticatedRequest } from './auth'

export function createNetworkLimit(): RequestHandler {
  const windows = new Map<string, { until: number; count: number }>()
  return (req: AuthenticatedRequest, res, next) => {
    const now = Date.now(), key = req.user!.id
    for (const [id, window] of windows) if (window.until <= now) windows.delete(id)
    if (windows.size >= 5000 && !windows.has(key)) { res.status(429).json({ message: 'Network services are busy. Try again in a minute.' }); return }
    const window = windows.get(key) ?? { until: now + 60_000, count: 0 }
    windows.set(key, window)
    if (++window.count > 60) { res.set('Retry-After', String(Math.ceil((window.until - now) / 1000))); res.status(429).json({ message: 'Too many network requests. Please wait a minute.' }); return }
    next()
  }
}
