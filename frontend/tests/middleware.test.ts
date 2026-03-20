import { NextRequest } from 'next/server'

// jose is ESM-only — mock it so Jest (CJS) can parse the middleware import
const mockJwtVerify = jest.fn()
jest.mock('jose', () => ({
  jwtVerify: mockJwtVerify,
  createRemoteJWKSet: jest.fn(),
}))

// Import after mock is registered
// eslint-disable-next-line import/first
import { middleware } from '../src/middleware'

process.env.JWT_SECRET = 'test-bff-secret'

function makeRequest(path: string, refreshToken?: string): NextRequest {
  const headers: HeadersInit = {}
  if (refreshToken) {
    headers['Cookie'] = `refresh_token=${refreshToken}`
  }
  return new NextRequest(`http://localhost${path}`, { headers })
}

describe('BFF middleware', () => {
  it('passes non-api requests through without auth check', async () => {
    const req = makeRequest('/some-page')
    const res = await middleware(req)
    expect(res.status).toBe(200)
  })

  it('returns 401 when refresh_token cookie is missing', async () => {
    const req = makeRequest('/api/bookings/hold')
    const res = await middleware(req)
    expect(res.status).toBe(401)
  })

  it('returns 401 when refresh_token is invalid', async () => {
    mockJwtVerify.mockRejectedValueOnce(new Error('invalid signature'))
    const req = makeRequest('/api/bookings/hold', 'not.a.valid.token')
    const res = await middleware(req)
    expect(res.status).toBe(401)
  })

  it('passes through with a valid refresh_token', async () => {
    mockJwtVerify.mockResolvedValueOnce({
      payload: { sub: 'user-abc', email: 'abc@test.com' },
    })
    const req = makeRequest('/api/bookings/hold', 'any.token.value')
    const res = await middleware(req)
    expect(res.status).toBe(200)
  })
})
