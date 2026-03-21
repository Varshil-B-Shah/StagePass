import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
} from '@aws-sdk/client-cognito-identity-provider'

const cognitoClient = new CognitoIdentityProviderClient({
  region: process.env.COGNITO_REGION || 'us-east-1',
})

export interface TokenPair {
  accessToken: string
  refreshToken?: string
}

/** Exchange a refresh token for a new access token.
 *  Returns null if the refresh token is expired or invalid. */
export async function refreshTokens(refreshToken: string): Promise<TokenPair | null> {
  try {
    const command = new InitiateAuthCommand({
      AuthFlow: 'REFRESH_TOKEN_AUTH',
      ClientId: process.env.COGNITO_CLIENT_ID!,
      AuthParameters: {
        REFRESH_TOKEN: refreshToken,
      },
    })
    const response = await cognitoClient.send(command)
    const result = response.AuthenticationResult
    if (!result?.AccessToken) return null
    return {
      accessToken: result.AccessToken,
      refreshToken: result.RefreshToken,
    }
  } catch {
    return null
  }
}
