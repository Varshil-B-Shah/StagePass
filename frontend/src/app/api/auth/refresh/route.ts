import { NextRequest, NextResponse } from 'next/server'
import { refreshTokens } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const refreshToken = req.cookies.get('refresh_token')?.value
  if (!refreshToken) {
    return NextResponse.json({ error: 'No refresh token' }, { status: 401 })
  }

  const tokens = await refreshTokens(refreshToken)
  if (!tokens) {
    return NextResponse.json({ error: 'Refresh failed' }, { status: 401 })
  }

  const res = NextResponse.json({ ok: true })
  res.cookies.set('access_token', tokens.accessToken, {
    httpOnly: true, secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax', maxAge: 3600,
  })
  return res
}
