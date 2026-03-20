import request from 'supertest'
import express from 'express'

// Mock clients before importing the router
jest.mock('../../src/clients/dynamo.client', () => ({
  getDynamoClient: jest.fn(),
}))
jest.mock('../../src/clients/prisma.client', () => ({
  getPrismaClient: jest.fn(),
}))
jest.mock('../../src/clients/redis.client', () => ({
  getRedisClient: jest.fn(),
}))

import { getDynamoClient } from '../../src/clients/dynamo.client'
import { getPrismaClient } from '../../src/clients/prisma.client'
import { getRedisClient } from '../../src/clients/redis.client'
import { healthRouter } from '../../src/routes/health.routes'

const app = express()
app.use(healthRouter)

beforeEach(() => jest.clearAllMocks())

describe('GET /healthz', () => {
  it('returns 200 with status ok', async () => {
    const res = await request(app).get('/healthz')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ status: 'ok' })
  })
})

describe('GET /ready', () => {
  it('returns 200 when all clients respond', async () => {
    ;(getDynamoClient as jest.Mock).mockReturnValue({
      scan: jest.fn().mockReturnValue({ promise: () => Promise.resolve({}) }),
    })
    ;(getPrismaClient as jest.Mock).mockReturnValue({
      $queryRaw: jest.fn().mockResolvedValue([]),
    })
    ;(getRedisClient as jest.Mock).mockResolvedValue({
      ping: jest.fn().mockResolvedValue('PONG'),
    })

    const res = await request(app).get('/ready')
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ status: 'ready' })
  })

  it('returns 503 when a client fails', async () => {
    ;(getDynamoClient as jest.Mock).mockReturnValue({
      scan: jest.fn().mockReturnValue({ promise: () => Promise.reject(new Error('timeout')) }),
    })
    ;(getPrismaClient as jest.Mock).mockReturnValue({
      $queryRaw: jest.fn().mockResolvedValue([]),
    })
    ;(getRedisClient as jest.Mock).mockResolvedValue({
      ping: jest.fn().mockResolvedValue('PONG'),
    })

    const res = await request(app).get('/ready')
    expect(res.status).toBe(503)
    expect(res.body).toMatchObject({ status: 'unavailable' })
    expect(res.body.failures).toEqual(expect.arrayContaining(['timeout']))
  })
})
