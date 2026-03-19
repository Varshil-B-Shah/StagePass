import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
} from '@aws-sdk/client-cognito-identity-provider'

const client = new CognitoIdentityProviderClient({
  region: process.env.COGNITO_REGION ?? 'us-east-1',
})

export async function refreshAccessToken(refreshToken: string): Promise<{
  access_token: string
  id_token: string
}> {
  const command = new InitiateAuthCommand({
    AuthFlow: 'REFRESH_TOKEN_AUTH',
    ClientId: process.env.COGNITO_CLIENT_ID!,
    AuthParameters: {
      REFRESH_TOKEN: refreshToken,
    },
  })

  const response = await client.send(command)

  if (!response.AuthenticationResult?.AccessToken) {
    throw new Error('Cognito refresh failed — no AccessToken in response')
  }

  return {
    access_token: response.AuthenticationResult.AccessToken,
    id_token: response.AuthenticationResult.IdToken ?? '',
  }
}
