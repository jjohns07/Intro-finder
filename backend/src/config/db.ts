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
  } catch (error) {
  console.error("Actual MongoDB error:", error);
  throw error;
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
