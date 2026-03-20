import { NextRequest, NextResponse } from 'next/server'
import {
  CognitoIdentityProviderClient,
  SignUpCommand,
} from '@aws-sdk/client-cognito-identity-provider'

const client = new CognitoIdentityProviderClient({ region: process.env.COGNITO_REGION! })

export async function POST(req: NextRequest) {
  const { email, password, firstName, lastName } = await req.json()
  if (!email || !password || !firstName) {
    return NextResponse.json({ error: 'email, password, firstName required' }, { status: 400 })
  }

  try {
    await client.send(new SignUpCommand({
      ClientId: process.env.COGNITO_CLIENT_ID!,
      Username: email,
      Password: password,
      UserAttributes: [
        { Name: 'email', Value: email },
        { Name: 'given_name', Value: firstName },
        { Name: 'family_name', Value: lastName || '' },
      ],
    }))
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const message = (err as { message?: string })?.message || 'Signup failed'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
