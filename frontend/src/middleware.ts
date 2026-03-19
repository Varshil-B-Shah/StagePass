import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { refreshAccessToken } from './lib/cognito'

export async function middleware(req: NextRequest) {
  if (!req.nextUrl.pathname.startsWith('/api')) {
    return NextResponse.next()
  }

  const refreshToken = req.cookies.get('refresh_token')?.value

  if (!refreshToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    let accessToken: string
    let payload: { sub: string; email?: string }

    if (process.env.NODE_ENV === 'production') {
      const tokens = await refreshAccessToken(refreshToken)
      accessToken = tokens.access_token
      payload = jwt.decode(accessToken) as { sub: string; email?: string }
    } else {
      const secret = process.env.JWT_SECRET!
      payload = jwt.verify(refreshToken, secret) as { sub: string; email?: string }
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
