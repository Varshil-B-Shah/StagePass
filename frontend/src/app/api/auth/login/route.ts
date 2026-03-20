import { NextRequest, NextResponse } from 'next/server'
import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
} from '@aws-sdk/client-cognito-identity-provider'

const client = new CognitoIdentityProviderClient({
  region: process.env.COGNITO_REGION!,
})

export async function POST(req: NextRequest) {
  const { email, password } = await req.json()
  if (!email || !password) {
    return NextResponse.json({ error: 'email and password required' }, { status: 400 })
  }

  try {
    const command = new InitiateAuthCommand({
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: process.env.COGNITO_CLIENT_ID!,
      AuthParameters: { USERNAME: email, PASSWORD: password },
    })
    const result = await client.send(command)
    const tokens = result.AuthenticationResult

    if (!tokens?.AccessToken || !tokens?.RefreshToken) {
      return NextResponse.json({ error: 'Login failed' }, { status: 401 })
    }

    const res = NextResponse.json({ ok: true })
    res.cookies.set('access_token', tokens.AccessToken, {
      httpOnly: true, secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax', maxAge: 3600,
    })
    res.cookies.set('refresh_token', tokens.RefreshToken, {
      httpOnly: true, secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax', maxAge: 30 * 24 * 3600,
    })
    return res
  } catch (err: unknown) {
    const message = (err as { message?: string })?.message || 'Login failed'
    return NextResponse.json({ error: message }, { status: 401 })
  }
}
