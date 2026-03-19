import 'dotenv/config'
import { BookingRepository } from '../../src/repositories/booking.repository'
import {
  getTestPrismaClient,
  clearTestBookings,
  TEST_USER_ID,
  TEST_SHOW_ID,
  TEST_SEAT_ID,
} from '../setup/db-setup'

let repo: BookingRepository

beforeAll(() => {
  repo = new BookingRepository(getTestPrismaClient())
})

beforeEach(async () => {
  await clearTestBookings()
})

describe('BookingRepository.createBooking', () => {
  it('creates a HOLD record and returns it with an id', async () => {
    const booking = await repo.createBooking({
      user_id: TEST_USER_ID,
      event_id: 'EVT-001',
      seat_ids: [TEST_SEAT_ID],
      held_until: new Date(Date.now() + 60_000),
    })

    expect(booking.id).toBeDefined()
    expect(booking.status).toBe('HOLD')
    expect(booking.seats).toContain(TEST_SEAT_ID)
    expect(booking.user_id).toBe(TEST_USER_ID)
  })
})

describe('BookingRepository.getActiveHoldByUser', () => {
  it('returns the active HOLD booking for a user', async () => {
    await repo.createBooking({
      user_id: TEST_USER_ID,
      event_id: 'EVT-001',
      seat_ids: [TEST_SEAT_ID],
      held_until: new Date(Date.now() + 60_000),
    })

    const found = await repo.getActiveHoldByUser(TEST_USER_ID)
    expect(found).not.toBeNull()
    expect(found?.status).toBe('HOLD')
  })

  it('returns null when no active hold exists', async () => {
    const found = await repo.getActiveHoldByUser(TEST_USER_ID)
    expect(found).toBeNull()
  })
})

describe('BookingRepository.updateBookingStatus', () => {
  it('updates the booking status', async () => {
    const booking = await repo.createBooking({
      user_id: TEST_USER_ID,
      event_id: 'EVT-001',
      seat_ids: [TEST_SEAT_ID],
      held_until: new Date(Date.now() + 60_000),
    })

    const updated = await repo.updateBookingStatus(booking.id, 'CANCELLED')
    expect(updated.status).toBe('CANCELLED')
  })
})
