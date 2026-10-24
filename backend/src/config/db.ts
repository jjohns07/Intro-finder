import mongoose from 'mongoose'

export async function connectDatabase(): Promise<void> {
  const mongoUri = process.env.MONGODB_URI

  if (!mongoUri) {
    console.warn('MONGODB_URI is not set. MongoDB connection skipped.')
    return
  }

  try {
    await mongoose.connect(mongoUri)
    console.log('MongoDB connected successfully.')
  } catch (_error) {
    console.error(
      'MongoDB connection failed. Check the MONGODB_URI value and Atlas network access settings.'
    )
    throw new Error('MongoDB connection failed')
  }
}

export function getDatabaseStatus(): string {
  switch (mongoose.connection.readyState) {
    case 1:
      return 'connected'
    case 2:
      return 'connecting'
    case 3:
      return 'disconnecting'
    default:
      return 'disconnected'
  }
}
