import jwt from 'jsonwebtoken'
import { GET } from '../../src/app/api/ws/auth/route'

const JWT_SECRET = 'test-ws-secret'
process.env.JWT_SECRET = JWT_SECRET

function makeWsAuthRequest(userId?: string, userEmail?: string) {
  const headers: Record<string, string> = {}
  if (userId) headers['x-user-id'] = userId
  if (userEmail) headers['x-user-email'] = userEmail
  return new Request('http://localhost/api/ws/auth', { headers })
}

describe('GET /api/ws/auth', () => {
  it('returns 401 when x-user-id header is missing', async () => {
    const res = await GET(makeWsAuthRequest())
    expect(res.status).toBe(401)
  })

  it('returns a signed JWT with sub claim', async () => {
    const res = await GET(makeWsAuthRequest('user-123', 'user@test.com'))
    expect(res.status).toBe(200)

    const { token, expires_in } = await res.json()
    expect(typeof token).toBe('string')
    expect(expires_in).toBe(3600)

    const payload = jwt.verify(token, JWT_SECRET) as { sub: string; email: string }
    expect(payload.sub).toBe('user-123')
    expect(payload.email).toBe('user@test.com')
  })

  it('token is verifiable with JWT_SECRET', async () => {
    const res = await GET(makeWsAuthRequest('user-456'))
    const { token } = await res.json()
    expect(() => jwt.verify(token, JWT_SECRET)).not.toThrow()
  })
})
