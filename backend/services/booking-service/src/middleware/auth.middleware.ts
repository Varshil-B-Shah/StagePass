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

// Machine-to-machine routes: payment-service and the compensation Lambdas call
// these with x-internal-secret and no user token.
const INTERNAL_PATHS = [
  '/api/bookings/confirm',
  '/api/bookings/expire',
  '/api/bookings/payment',
  '/api/bookings/refund',
  '/api/bookings/refund-settled',
]

/** GET /api/bookings/:id is dual-use — the Lambdas read it with the shared secret,
 *  while a browser reaches the same handler with a JWT. '/my' is user-only and is
 *  excluded so it can never be reached without a token. */
function isInternalReadable(req: Request): boolean {
  return (
    req.method === 'GET' &&
    /^\/api\/bookings\/[^/]+$/.test(req.path) &&
    req.path !== '/api/bookings/my'
  )
}

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

  // Internal service calls use x-internal-secret instead of a JWT.
  const secret = req.headers['x-internal-secret']
  const secretValid = Boolean(secret) && secret === process.env.INTERNAL_API_SECRET

  if (INTERNAL_PATHS.includes(req.path)) {
    if (secretValid) {
      next()
      return
    }
    res.status(403).json({ error: 'Forbidden' })
    return
  }

  // Dual-use route: a valid secret authenticates the caller, anything else falls
  // through to the normal JWT check below.
  if (secretValid && isInternalReadable(req)) {
    next()
    return
  }

  const auth = req.headers.authorization
  if (!auth || !auth.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' })
    return
  }

  const token = auth.slice(7)

  // Cognito JWKS by default. AUTH_MODE=local accepts HS256 tokens signed with
  // JWT_SECRET — local load testing only, never honoured in production.
  const useLocal = process.env.AUTH_MODE === 'local' && config.node_env !== 'production'
  const verify = useLocal ? async (t: string) => verifyLocal(t) : verifyProd

  verify(token)
    .then((user) => {
      req.user = user
      next()
    })
    .catch(() => {
      res.status(401).json({ error: 'Invalid token' })
    })
}
