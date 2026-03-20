import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify, createRemoteJWKSet } from 'jose'
import { refreshTokens } from './lib/auth'

const PUBLIC_PATHS = [
  '/api/dev/auth',
  '/api/auth/login',
  '/api/auth/signup',
  '/api/auth/verify',
  '/api/auth/refresh',
  '/api/auth/logout',
]

export async function middleware(req: NextRequest) {
  if (!req.nextUrl.pathname.startsWith('/api')) {
    return NextResponse.next()
  }

  if (PUBLIC_PATHS.includes(req.nextUrl.pathname)) {
    return NextResponse.next()
  }

  const accessToken = req.cookies.get('access_token')?.value
  const refreshToken = req.cookies.get('refresh_token')?.value

  if (!accessToken && !refreshToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Try to verify the access token
  if (accessToken) {
    try {
      const payload = await verifyAccessToken(accessToken)
      if (payload?.sub) {
        return buildResponse(req, accessToken, payload)
      }
    } catch (err: unknown) {
      // If not expired, it's invalid — reject immediately
      if (!isExpiredError(err)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      // Expired — fall through to refresh
    }
  }

  // Access token missing or expired — try refresh
  if (!refreshToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const tokens = await refreshTokens(refreshToken)
  if (!tokens) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const payload = await verifyAccessToken(tokens.accessToken).catch(() => null)
  if (!payload?.sub) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const res = buildResponse(req, tokens.accessToken, payload)
  res.cookies.set('access_token', tokens.accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 3600,
  })
  if (tokens.refreshToken) {
    res.cookies.set('refresh_token', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 3600,
    })
  }
  return res
}

async function verifyAccessToken(token: string): Promise<{ sub?: string; email?: string }> {
  if (process.env.NODE_ENV === 'production') {
    const jwksUrl = new URL(
      `https://cognito-idp.${process.env.COGNITO_REGION}.amazonaws.com/${process.env.COGNITO_USER_POOL_ID}/.well-known/jwks.json`
    )
    const JWKS = createRemoteJWKSet(jwksUrl)
    const { payload } = await jwtVerify(token, JWKS)
    return payload as { sub?: string; email?: string }
  } else {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET!)
    const { payload } = await jwtVerify(token, secret)
    return payload as { sub?: string; email?: string }
  }
}

function isExpiredError(err: unknown): boolean {
  return (err as { code?: string })?.code === 'ERR_JWT_EXPIRED'
}

function buildResponse(
  req: NextRequest,
  accessToken: string,
  payload: { sub?: string; email?: string }
) {
  const requestHeaders = new Headers(req.headers)
  requestHeaders.set('x-access-token', accessToken)
  requestHeaders.set('x-user-id', payload.sub!)
  requestHeaders.set('x-user-email', payload.email ?? '')
  return NextResponse.next({ request: { headers: requestHeaders } })
}

export const config = {
  matcher: '/api/:path*',
}
