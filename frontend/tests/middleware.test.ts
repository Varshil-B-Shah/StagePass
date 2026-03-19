import jwt from 'jsonwebtoken'
import { NextRequest } from 'next/server'
import { middleware } from '../src/middleware'

const JWT_SECRET = 'test-bff-secret'
process.env.JWT_SECRET = JWT_SECRET

function makeRefreshToken(sub = 'user-1', email = 'user@test.com') {
  return jwt.sign({ sub, email }, JWT_SECRET, { expiresIn: '1h' })
}

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
    const req = makeRequest('/api/bookings/hold', 'not.a.valid.token')
    const res = await middleware(req)
    expect(res.status).toBe(401)
  })

  it('passes through with a valid refresh_token', async () => {
    const token = makeRefreshToken('user-abc', 'abc@test.com')
    const req = makeRequest('/api/bookings/hold', token)
    const res = await middleware(req)
    expect(res.status).toBe(200)
  })
})
