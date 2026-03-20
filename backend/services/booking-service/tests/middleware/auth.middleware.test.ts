import jwt from 'jsonwebtoken'
import { Request, Response, NextFunction } from 'express'

// Must set env before importing the middleware
process.env.JWT_SECRET = 'test-secret'
process.env.NODE_ENV = 'development'

import { authMiddleware } from '../../src/middleware/auth.middleware'

function makeReq(overrides: Partial<Request> = {}): Request {
  return {
    headers: {},
    path: '/api/bookings/hold',
    ...overrides,
  } as unknown as Request
}

function makeRes(): Response {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  }
  return res as unknown as Response
}

describe('authMiddleware', () => {
  const next = jest.fn() as NextFunction
  const SECRET = 'test-secret'

  beforeEach(() => jest.clearAllMocks())

  it('calls next() for public routes', () => {
    const req = makeReq({ path: '/healthz' })
    authMiddleware(req, makeRes(), next)
    expect(next).toHaveBeenCalledWith()
  })

  it('returns 401 when Authorization header is missing', () => {
    const res = makeRes()
    authMiddleware(makeReq(), res, next)
    expect(res.status).toHaveBeenCalledWith(401)
    expect(next).not.toHaveBeenCalled()
  })

  it('returns 401 when token is malformed', () => {
    const req = makeReq({ headers: { authorization: 'Bearer not.a.token' } })
    const res = makeRes()
    authMiddleware(req, res, next)
    expect(res.status).toHaveBeenCalledWith(401)
  })

  it('returns 401 when token is signed with wrong secret', () => {
    const token = jwt.sign({ sub: 'user-1' }, 'wrong-secret', { expiresIn: '1h' })
    const req = makeReq({ headers: { authorization: `Bearer ${token}` } })
    const res = makeRes()
    authMiddleware(req, res, next)
    expect(res.status).toHaveBeenCalledWith(401)
  })

  it('returns 401 when token is expired', () => {
    const token = jwt.sign({ sub: 'user-1' }, SECRET, { expiresIn: -1 })
    const req = makeReq({ headers: { authorization: `Bearer ${token}` } })
    const res = makeRes()
    authMiddleware(req, res, next)
    expect(res.status).toHaveBeenCalledWith(401)
  })

  it('attaches decoded user and calls next() for a valid token', () => {
    const token = jwt.sign({ sub: 'user-abc', email: 'a@b.com' }, SECRET, { expiresIn: '1h' })
    const req = makeReq({ headers: { authorization: `Bearer ${token}` } })
    authMiddleware(req, makeRes(), next)
    expect(next).toHaveBeenCalledWith()
    expect(req.user).toMatchObject({ sub: 'user-abc' })
  })
})
