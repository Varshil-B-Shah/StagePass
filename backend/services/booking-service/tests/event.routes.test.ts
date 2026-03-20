import request from 'supertest'
import express from 'express'
import { createEventRouter } from '../src/routes/event.routes'
import { EventController } from '../src/controllers/event.controller'

// Mock Prisma so tests never hit a real database
jest.mock('../src/clients/prisma.client', () => ({
  prisma: {
    event: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
  },
}))
import { prisma } from '../src/clients/prisma.client'
const mockEvent = prisma.event as jest.Mocked<typeof prisma.event>

function makeApp() {
  const app = express()
  app.use(express.json())
  const controller = new EventController(prisma)
  app.use('/api/events', createEventRouter(controller))
  return app
}

const MOCK_EVENT = {
  id: 'EVT-001',
  title: 'Test Concert',
  description: null,
  venue_id: 'VEN-001',
  venue: { id: 'VEN-001', name: 'Test Arena', address: '1 Main St', city: 'NYC', state: 'NY', capacity: 500 },
  start_at: new Date('2025-04-01T19:00:00Z'),
  end_at: new Date('2025-04-01T22:00:00Z'),
  status: 'LIVE',
  organizer_id: 'ORG-001',
  price_tiers: [{ id: 'tier-1', event_id: 'EVT-001', name: 'General', price: 50, seat_types: [] }],
  created_at: new Date(),
  updated_at: new Date(),
}

describe('Event routes', () => {
  beforeEach(() => jest.clearAllMocks())

  it('GET /api/events returns list of LIVE events', async () => {
    mockEvent.findMany.mockResolvedValueOnce([MOCK_EVENT])

    const res = await request(makeApp()).get('/api/events')

    expect(res.status).toBe(200)
    expect(res.body.events).toHaveLength(1)
    expect(res.body.events[0].id).toBe('EVT-001')
    // Verify the query filtered for LIVE events
    expect(mockEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: 'LIVE' },
      })
    )
  })

  it('GET /api/events/:id returns a single event', async () => {
    mockEvent.findUnique.mockResolvedValueOnce(MOCK_EVENT)

    const res = await request(makeApp()).get('/api/events/EVT-001')

    expect(res.status).toBe(200)
    expect(res.body.id).toBe('EVT-001')
  })

  it('GET /api/events/:id returns 404 when event does not exist', async () => {
    mockEvent.findUnique.mockResolvedValueOnce(null)

    const res = await request(makeApp()).get('/api/events/NO-SUCH-ID')

    expect(res.status).toBe(404)
    expect(res.body.error).toBeDefined()
  })
})
