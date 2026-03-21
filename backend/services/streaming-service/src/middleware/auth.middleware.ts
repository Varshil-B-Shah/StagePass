import { Request, Response, NextFunction } from 'express'
import jwt, { JwtPayload } from 'jsonwebtoken'
import jwksRsa from 'jwks-rsa'
import { config } from '../config'

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload
    }
  }
}

const PUBLIC_PATHS = ['/healthz', '/ready']

// Stream status + chat history are public — no auth needed to see if a stream is live
function isPublicRequest(req: Request): boolean {
  if (PUBLIC_PATHS.includes(req.path)) return true
  if (req.method === 'GET' && /^\/api\/streams\/[^/]+$/.test(req.path)) return true
  if (req.method === 'GET' && /^\/api\/streams\/[^/]+\/chat$/.test(req.path)) return true
  return false
}

async function verifyCognito(token: string): Promise<JwtPayload> {
  const decoded = jwt.decode(token, { complete: true })
  if (!decoded || typeof decoded === 'string') throw new Error('Invalid token')

  const jwksClient = jwksRsa({
    jwksUri: `https://cognito-idp.${config.cognito.region}.amazonaws.com/${config.cognito.user_pool_id}/.well-known/jwks.json`,
    cache: true,
    rateLimit: true,
  })

  const key = await jwksClient.getSigningKey(decoded.header.kid)
  const result = jwt.verify(token, key.getPublicKey(), { algorithms: ['RS256'] })
  if (typeof result === 'string') throw new Error('Invalid token payload')
  return result
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (isPublicRequest(req)) { next(); return }

  const auth = req.headers.authorization
  if (!auth?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' })
    return
  }

  verifyCognito(auth.slice(7))
    .then((user) => { req.user = user; next() })
    .catch(() => res.status(401).json({ error: 'Invalid token' }))
}
