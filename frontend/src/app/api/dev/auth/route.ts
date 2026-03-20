import { NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'

export async function POST(req: Request) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 404 })
  }

  const body = await req.json().catch(() => ({})) as { sub?: string; email?: string }
  const sub = body.sub ?? 'dev-user-001'
  const email = body.email ?? 'dev@stagepass.local'

  const token = jwt.sign(
    { sub, email },
    process.env.JWT_SECRET!,
    { expiresIn: '24h' }
  )

  const response = NextResponse.json({ success: true })
  response.cookies.set('refresh_token', token, {
    httpOnly: true,
    path: '/',
    maxAge: 86_400,  // 24 hours
    sameSite: 'lax',
  })

  return response
}
