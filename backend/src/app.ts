import express, { type ErrorRequestHandler } from 'express'
import cors from 'cors'
import { getDatabaseStatus } from './config/db'
import authRoutes from './routes/auth'
import historyRoutes from './routes/history'
import { createDiscoveryRoutes } from './routes/discovery'
import { discoveryProvider, type DiscoveryProvider } from './discovery/provider'

export function createApp(provider: DiscoveryProvider = discoveryProvider) {
  const app = express()
  app.use(cors())
  app.use(express.json())
  app.use('/api/auth', authRoutes)
  app.get('/api/health', (_req, res) => {
    res.json({ api: { status: 'ok', message: 'Intro Finder API is running', port: Number(process.env.PORT) || 5000 },
      database: { status: getDatabaseStatus(), configured: Boolean(process.env.MONGODB_URI) } })
  })
  // Do not queue history requests against a disconnected database or cache
  // one user's private results in a browser/proxy shared with another user.
  app.use(['/api/history', '/api/discovery'], (_req, res, next) => {
    res.set('Cache-Control', 'no-store')
    if (getDatabaseStatus() !== 'connected') { res.status(503).json({ message: 'Search history is temporarily unavailable. Please try again.' }); return }
    next()
  })
  app.use('/api/history', historyRoutes)
  app.use('/api/discovery', createDiscoveryRoutes(provider))
  const handleError: ErrorRequestHandler = (error, _req, res, _next) => {
    if (res.headersSent) { _next(error); return }
    if (error?.type === 'entity.parse.failed') { res.status(400).json({ message: 'Invalid JSON request.' }); return }
    res.status(500).json({ message: 'The request could not be completed. Please try again.' })
  }
  app.use(handleError)
  return app
}
