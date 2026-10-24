import jwt, { type JwtPayload } from 'jsonwebtoken'

export function getJwtConfig(): { secret: string; expiresIn: string } {
  const secret = process.env.JWT_SECRET
  const expiresIn = process.env.JWT_EXPIRES_IN

  if (!secret) {
    throw new Error('JWT_SECRET is missing. Add it to your backend .env file.')
  }

  if (secret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters long.')
  }

  if (!expiresIn) {
    throw new Error('JWT_EXPIRES_IN is missing. Add it to your backend .env file.')
  }

  return { secret, expiresIn }
}

export function generateToken(userId: string, email: string): string {
  const { secret, expiresIn } = getJwtConfig()

  return jwt.sign({ sub: userId, email }, secret, {
    expiresIn,
  })
}

export function verifyToken(token: string): JwtPayload & { sub: string; email: string } {
  const { secret } = getJwtConfig()

  return jwt.verify(token, secret) as JwtPayload & { sub: string; email: string }
}
