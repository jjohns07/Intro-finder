import path from 'path'
import dotenv from 'dotenv'
import { createApp } from './app'
import SearchHistory from './models/SearchHistory'
import { getJwtConfig } from './config/auth'
import { connectDatabase, getDatabaseStatus } from './config/db'

dotenv.config({ path: path.resolve(__dirname, '../.env') })

const app = createApp()
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
    })
  } catch (error) {
    console.error('Failed to start server:', error)
    process.exit(1)
  }
}

startServer()
