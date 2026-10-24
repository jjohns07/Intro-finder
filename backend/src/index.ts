import path from 'path'
import dotenv from 'dotenv'
import express from 'express'
import cors from 'cors'
import { getJwtConfig } from './config/auth'
import { connectDatabase, getDatabaseStatus } from './config/db'
import authRoutes from './routes/auth'

dotenv.config({ path: path.resolve(__dirname, '../.env') })

const app = express()
const port = Number(process.env.PORT) || 5000

try {
  getJwtConfig()
} catch (error) {
  console.error(
    error instanceof Error ? error.message : 'JWT configuration error. Check your environment variables.'
  )
  process.exit(1)
}

app.use(cors())
app.use(express.json())
app.use('/api/auth', authRoutes)

app.get('/api/health', async (_req, res) => {
  const databaseStatus = getDatabaseStatus()

  res.json({
    api: {
      status: 'ok',
      message: 'Intro Finder API is running',
      port,
    },
    database: {
      status: databaseStatus,
      configured: Boolean(process.env.MONGODB_URI),
    },
  })
})

async function startServer(): Promise<void> {
  try {
    await connectDatabase()

    app.listen(port, () => {
      console.log(`Intro Finder API listening on port ${port}`)
    })
  } catch (error) {
    console.error('Failed to start server:', error)
    process.exit(1)
  }
}

startServer()
