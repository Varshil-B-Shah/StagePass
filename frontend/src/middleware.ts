import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify, createRemoteJWKSet } from 'jose'

export async function middleware(req: NextRequest) {
  if (!req.nextUrl.pathname.startsWith('/api')) {
    return NextResponse.next()
  }

  // Dev auth endpoint creates the session cookie — must be exempt from auth check
  if (req.nextUrl.pathname === '/api/dev/auth') {
    return NextResponse.next()
  }

  const refreshToken = req.cookies.get('refresh_token')?.value

  if (!refreshToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    let accessToken: string
    let payload: { sub?: string; email?: string }

    if (process.env.NODE_ENV === 'production') {
      // Production: verify against Cognito JWKS
      const jwksUrl = new URL(
        `https://cognito-idp.${process.env.COGNITO_REGION}.amazonaws.com/${process.env.COGNITO_USER_POOL_ID}/.well-known/jwks.json`
      )
      const JWKS = createRemoteJWKSet(jwksUrl)
      const { payload: p } = await jwtVerify(refreshToken, JWKS)
      payload = p as { sub?: string; email?: string }
      accessToken = refreshToken
    } else {
      // Dev: verify with shared JWT_SECRET
      const secret = new TextEncoder().encode(process.env.JWT_SECRET!)
      const { payload: p } = await jwtVerify(refreshToken, secret)
      payload = p as { sub?: string; email?: string }
      accessToken = refreshToken
    }

    if (!payload?.sub) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const requestHeaders = new Headers(req.headers)
    requestHeaders.set('x-access-token', accessToken)
    requestHeaders.set('x-user-id', payload.sub)
    requestHeaders.set('x-user-email', payload.email ?? '')

    return NextResponse.next({
      request: { headers: requestHeaders },
    })
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}

export const config = {
  matcher: '/api/:path*',
}
