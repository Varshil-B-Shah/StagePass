import { SeatRepository } from '../../src/repositories/seat.repository'
import { RedisRepository } from '../../src/repositories/redis.repository'
import { BookingRepository } from '../../src/repositories/booking.repository'
import { SeatService } from '../../src/services/seat.service'
import type { IWsService } from '../../src/services/ws.service'
import { getDynamoClient } from '../../src/clients/dynamo.client'
import { getRedisClient } from '../../src/clients/redis.client'
import { prisma } from '../../src/clients/prisma.client'
import { resetSeat, clearHoldKeys } from '../setup/db-setup'

const SHOW_ID = 'EVT-001#2025-04-01#19:00'
const SEAT_ID = 'C1'   // Use a seat letter/number not used in any other test file

// Stub WsService — integration test does not require ws-server to be running
const stubWsService: IWsService = {
  broadcast: async () => {},
}

let seatService: SeatService
let seatRepo: SeatRepository

beforeAll(() => {
  seatRepo = new SeatRepository(getDynamoClient())
  const redisRepo = new RedisRepository(getRedisClient())
  const bookingRepo = new BookingRepository(prisma)
  seatService = new SeatService(seatRepo, redisRepo, bookingRepo, stubWsService)
})

beforeEach(async () => {
  // Ensure seat is AVAILABLE and no holds exist before each test
  await Promise.all([
    resetSeat(SHOW_ID, SEAT_ID),
    clearHoldKeys(SHOW_ID, SEAT_ID),
  ])
})

afterAll(async () => {
  // Leave the seat AVAILABLE for subsequent manual testing
  await resetSeat(SHOW_ID, SEAT_ID)
})

describe('Concurrent seat holds', () => {
  it('exactly one of two simultaneous hold attempts succeeds; the other gets a 409', async () => {
    // Fire both hold requests at the same instant — Promise.all launches them truly concurrently.
    // The DynamoDB conditional write (ConditionExpression: "#status = :available") guarantees
    // atomicity: only one writer can transition AVAILABLE → HELD.
    const [result1, result2] = await Promise.allSettled([
      seatService.holdSeat(SHOW_ID, SEAT_ID, 'user-alice'),
      seatService.holdSeat(SHOW_ID, SEAT_ID, 'user-bob'),
    ])

    const successes = [result1, result2].filter((r) => r.status === 'fulfilled')
    const failures  = [result1, result2].filter((r) => r.status === 'rejected')

    // Exactly one winner
    expect(successes).toHaveLength(1)

    // Exactly one loser — with a 409 BusinessError
    expect(failures).toHaveLength(1)
    const err = (failures[0] as PromiseRejectedResult).reason as { statusCode: number }
    expect(err.statusCode).toBe(409)

    // DynamoDB reflects exactly one HELD seat (not two, not zero)
    const seat = await seatRepo.getSeat(SHOW_ID, SEAT_ID)
    expect(seat?.status).toBe('HELD')
  })
})
