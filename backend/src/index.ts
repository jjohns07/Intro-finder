import path from 'path'
import dotenv from 'dotenv'
import { createApp } from './app'
import SearchHistory from './models/SearchHistory'
import { getJwtConfig } from './config/auth'
import { connectDatabase, getDatabaseStatus } from './config/db'
import { createDiscoveryProvider, shouldVerifyOnStartup } from './discovery/provider'

dotenv.config({ path: path.resolve(__dirname, '../.env') })

const provider = createDiscoveryProvider()
const app = createApp(provider)
const port = Number(process.env.PORT) || 5000

try {
  getJwtConfig()
} catch (error) {
  console.error(
    error instanceof Error ? error.message : 'JWT configuration error. Check your environment variables.'
  )
  process.exit(1)
}

async function startServer(): Promise<void> {
  try {
    await connectDatabase()
    if (getDatabaseStatus() === 'connected') await SearchHistory.init()

    app.listen(port, () => {
      console.log(`Intro Finder API listening on port ${port}`)
      if (shouldVerifyOnStartup(provider)) {
        void provider.verifyConnection?.().then(verification => {
          // The report contains only fixed statuses, a count and a timestamp.
          console.info('Skrapp discovery API verification:', verification)
        }).catch(() => {
          console.error('Skrapp discovery API verification could not complete.')
        })
      }
    })
  } catch (error) {
    console.error('Failed to start server:', error)
    process.exit(1)
  }
}

startServer()
