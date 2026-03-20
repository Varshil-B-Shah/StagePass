import { NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'

export async function GET(req: Request) {
  const userId = req.headers.get('x-user-id')
  const userEmail = req.headers.get('x-user-email') ?? ''

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const token = jwt.sign(
    { sub: userId, email: userEmail },
    process.env.JWT_SECRET!,
    { expiresIn: '1h' }
  )

  return NextResponse.json({ token, expires_in: 3600 })
}
