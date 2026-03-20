import request from 'supertest'
import express from 'express'
import jwt from 'jsonwebtoken'
import { authMiddleware } from '../../src/middleware/auth.middleware'
import { errorMiddleware } from '../../src/middleware/error.middleware'
import { SeatService } from '../../src/services/seat.service'
import { createSeatRouter } from '../../src/routes/seat.routes'
import { BusinessError } from '../../src/errors'

process.env.JWT_SECRET = 'test-secret'
process.env.NODE_ENV = 'development'

const mockService = {
  holdSeat: jest.fn(),
  getSeatMap: jest.fn(),
  getUserHolds: jest.fn(),
  releaseHold: jest.fn(),
} as unknown as jest.Mocked<SeatService>

function makeApp() {
  const app = express()
  app.use(express.json())
  app.use(authMiddleware)
  app.use('/api/bookings', createSeatRouter(mockService))
  app.use(errorMiddleware)
  return app
}

function validToken(userId = 'user-123') {
  return jwt.sign({ sub: userId }, 'test-secret', { expiresIn: '1h' })
}

beforeEach(() => jest.clearAllMocks())

describe('POST /api/bookings/hold', () => {
  it('returns 401 without a token', async () => {
    const res = await request(makeApp()).post('/api/bookings/hold').send({ show_id: 'S', seat_id: 'A1' })
    expect(res.status).toBe(401)
  })

  it('returns 200 with expires_at on success', async () => {
    mockService.holdSeat.mockResolvedValue({ success: true, expires_at: Date.now() + 60_000 })
    const res = await request(makeApp())
      .post('/api/bookings/hold')
      .set('Authorization', `Bearer ${validToken()}`)
      .send({ show_id: 'EVT-001#2025-04-01#19:00', seat_id: 'A1' })
    expect(res.status).toBe(200)
    expect(res.body.expires_at).toBeDefined()
  })

  it('returns 409 when seat is taken', async () => {
    mockService.holdSeat.mockRejectedValue(new BusinessError('Seat already taken', 409))
    const res = await request(makeApp())
      .post('/api/bookings/hold')
      .set('Authorization', `Bearer ${validToken()}`)
      .send({ show_id: 'EVT-001#2025-04-01#19:00', seat_id: 'A1' })
    expect(res.status).toBe(409)
  })

  it('returns 400 when body is missing required fields', async () => {
    const res = await request(makeApp())
      .post('/api/bookings/hold')
      .set('Authorization', `Bearer ${validToken()}`)
      .send({})
    expect(res.status).toBe(400)
    expect(mockService.holdSeat).not.toHaveBeenCalled()
  })
})

describe('GET /api/bookings/seat-map/:show_id', () => {
  it('returns 200 with rows', async () => {
    mockService.getSeatMap.mockResolvedValue({ show_id: 'S', rows: [] })
    const res = await request(makeApp())
      .get('/api/bookings/seat-map/EVT-001%232025-04-01%2319:00')
      .set('Authorization', `Bearer ${validToken()}`)
    expect(res.status).toBe(200)
    expect(res.body.rows).toBeDefined()
  })
})

describe('GET /api/bookings/user-holds/:show_id', () => {
  it('returns 200 with seat_ids array', async () => {
    mockService.getUserHolds.mockResolvedValue(['A1'])
    const res = await request(makeApp())
      .get('/api/bookings/user-holds/EVT-001%232025-04-01%2319:00')
      .set('Authorization', `Bearer ${validToken()}`)
    expect(res.status).toBe(200)
    expect(res.body.seat_ids).toEqual(['A1'])
  })
})
