import { Request, Response, NextFunction } from 'express'
import jwt, { JwtPayload } from 'jsonwebtoken'
import jwksRsa from 'jwks-rsa'
import { config } from '../config'

// Extend Express Request to carry decoded user
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload
    }
  }
}

const PUBLIC_PATHS = ['/healthz', '/ready']

function verifyLocal(token: string): JwtPayload {
  if (!config.jwt_secret) throw new Error('JWT_SECRET not set')
  const result = jwt.verify(token, config.jwt_secret)
  if (typeof result === 'string') throw new Error('Invalid token payload')
  return result
}

async function verifyProd(token: string): Promise<JwtPayload> {
  const decoded = jwt.decode(token, { complete: true })
  if (!decoded || typeof decoded === 'string') throw new Error('Invalid token structure')

  const jwksClient = jwksRsa({
    jwksUri: `https://cognito-idp.${config.cognito.region}.amazonaws.com/${config.cognito.user_pool_id}/.well-known/jwks.json`,
    cache: true,
    rateLimit: true,
  })

  const key = await jwksClient.getSigningKey(decoded.header.kid)
  const signingKey = key.getPublicKey()
  const result = jwt.verify(token, signingKey, { algorithms: ['RS256'] })
  if (typeof result === 'string') throw new Error('Invalid token payload')
  return result
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (PUBLIC_PATHS.includes(req.path)) {
    next()
    return
  }

  const auth = req.headers.authorization
  if (!auth || !auth.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' })
    return
  }

  const token = auth.slice(7)

  if (config.node_env !== 'production') {
    try {
      req.user = verifyLocal(token)
      next()
    } catch {
      res.status(401).json({ error: 'Invalid token' })
    }
    return
  }

  // Production: async JWKS verification
  verifyProd(token)
    .then((user) => {
      req.user = user
      next()
    })
    .catch(() => {
      res.status(401).json({ error: 'Invalid token' })
    })
}
