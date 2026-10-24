import type { Request, Response } from 'express'
import bcrypt from 'bcrypt'
import User from '../models/User'
import { generateToken } from '../config/auth'
import type { AuthenticatedRequest } from '../middleware/auth'

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function registerUser(req: Request, res: Response): Promise<void> {
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : ''
  const email = typeof req.body?.email === 'string' ? normalizeEmail(req.body.email) : ''
  const password = typeof req.body?.password === 'string' ? req.body.password : ''

  if (!name || name.length < 2) {
    res.status(400).json({ message: 'Name must be at least 2 characters long.' })
    return
  }

  if (!email || !emailPattern.test(email)) {
    res.status(400).json({ message: 'Please provide a valid email address.' })
    return
  }

  if (!password || password.length < 8) {
    res.status(400).json({ message: 'Password must be at least 8 characters long.' })
    return
  }

  try {
    const existingUser = await User.findOne({ email })

    if (existingUser) {
      res.status(409).json({ message: 'An account with this email already exists.' })
      return
    }

    const hashedPassword = await bcrypt.hash(password, 12)

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
    })

    const token = generateToken(user._id.toString(), user.email)

    res.status(201).json({
      token,
      user: user.toSafeObject(),
    })
  } catch (error) {
    console.error('Registration failed:', error)
    res.status(500).json({ message: 'Unable to register user right now.' })
  }
}

export async function loginUser(req: Request, res: Response): Promise<void> {
  const email = typeof req.body?.email === 'string' ? normalizeEmail(req.body.email) : ''
  const password = typeof req.body?.password === 'string' ? req.body.password : ''

  if (!email || !emailPattern.test(email) || !password) {
    res.status(400).json({ message: 'Invalid email or password.' })
    return
  }

  try {
    const user = await User.findOne({ email })

    if (!user) {
      res.status(401).json({ message: 'Invalid email or password.' })
      return
    }

    const isPasswordValid = await bcrypt.compare(password, user.password)

    if (!isPasswordValid) {
      res.status(401).json({ message: 'Invalid email or password.' })
      return
    }

    const token = generateToken(user._id.toString(), user.email)

    res.status(200).json({
      token,
      user: user.toSafeObject(),
    })
  } catch (error) {
    console.error('Login failed:', error)
    res.status(500).json({ message: 'Unable to log in right now.' })
  }
}

export async function getCurrentUser(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  if (!req.user) {
    res.status(401).json({ message: 'Authentication required.' })
    return
  }

  res.status(200).json({
    user: {
      id: req.user.id,
      name: req.user.name,
      email: req.user.email,
    },
  })
}
