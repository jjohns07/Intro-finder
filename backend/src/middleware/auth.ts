import type { NextFunction, Request, Response } from 'express'
import User from '../models/User'
import { verifyToken } from '../config/auth'

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string
    name: string
    email: string
  }
}

export async function protect(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ message: 'Authentication required.' })
      return
    }

    const token = authHeader.split(' ')[1]
    const payload = verifyToken(token)

    if (!payload.sub) {
      res.status(401).json({ message: 'Invalid token.' })
      return
    }

    const user = await User.findById(payload.sub).select('-password')

    if (!user) {
      res.status(401).json({ message: 'User not found.' })
      return
    }

    req.user = {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
    }

    next()
  } catch (_error) {
    res.status(401).json({ message: 'Invalid or expired token.' })
  }
}
