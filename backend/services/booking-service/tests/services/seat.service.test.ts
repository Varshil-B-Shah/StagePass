import { SeatService } from '../../src/services/seat.service'
import { SeatRepository } from '../../src/repositories/seat.repository'
import { RedisRepository } from '../../src/repositories/redis.repository'
import { BookingRepository } from '../../src/repositories/booking.repository'
import { IWsService } from '../../src/services/ws.service'
import { BusinessError } from '../../src/errors'

// ── Typed mocks ────────────────────────────────────────────────────
const mockSeatRepo = {
  getSeatMap: jest.fn(),
  getSeat: jest.fn(),
  holdSeat: jest.fn(),
  releaseSeat: jest.fn(),
  confirmSeat: jest.fn(),
  getUserHoldsFromDynamo: jest.fn(),
} as unknown as jest.Mocked<SeatRepository>

const mockRedisRepo = {
  setHold: jest.fn(),
  delHold: jest.fn(),
  getUserHolds: jest.fn(),
} as unknown as jest.Mocked<RedisRepository>

const mockBookingRepo = {
  createBooking: jest.fn(),
  getActiveHoldByUser: jest.fn(),
  updateBookingStatus: jest.fn(),
} as unknown as jest.Mocked<BookingRepository>

const mockWs: jest.Mocked<IWsService> = { broadcast: jest.fn() }

const SHOW = 'EVT-001#2025-04-01#19:00'
const SEAT = 'A1'
const USER = 'user-abc'

let service: SeatService

beforeEach(() => {
  jest.clearAllMocks()
  service = new SeatService(mockSeatRepo, mockRedisRepo, mockBookingRepo, mockWs)
})

// ── holdSeat ────────────────────────────────────────────────────────

describe('SeatService.holdSeat', () => {
  beforeEach(() => {
    mockRedisRepo.getUserHolds.mockResolvedValue([])
    mockSeatRepo.holdSeat.mockResolvedValue(undefined)
    mockRedisRepo.setHold.mockResolvedValue(undefined)
    mockWs.broadcast.mockResolvedValue(undefined)
    mockBookingRepo.createBooking.mockResolvedValue({ id: 'bk-1' } as any)
  })

  it('returns expires_at on success', async () => {
    const result = await service.holdSeat(SHOW, SEAT, USER)
    expect(result.expires_at).toBeGreaterThan(Date.now())
    expect(result.success).toBe(true)
  })

  it('calls DynamoDB conditional write', async () => {
    await service.holdSeat(SHOW, SEAT, USER)
    expect(mockSeatRepo.holdSeat).toHaveBeenCalledWith(
      expect.objectContaining({ show_id: SHOW, seat_id: SEAT, user_id: USER })
    )
  })

  it('sets Redis hold after DynamoDB write', async () => {
    await service.holdSeat(SHOW, SEAT, USER)
    expect(mockRedisRepo.setHold).toHaveBeenCalledWith(SHOW, SEAT, USER, 60)
  })

  it('broadcasts HELD to show channel (best effort)', async () => {
    await service.holdSeat(SHOW, SEAT, USER)
    expect(mockWs.broadcast).toHaveBeenCalledWith(
      `show:${SHOW}`,
      expect.objectContaining({ seat_id: SEAT, status: 'HELD' })
    )
  })

  it('throws BusinessError 400 when user already holds a seat', async () => {
    mockRedisRepo.getUserHolds.mockResolvedValue([SEAT])
    await expect(service.holdSeat(SHOW, SEAT, USER)).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringContaining('already holds'),
    })
    expect(mockSeatRepo.holdSeat).not.toHaveBeenCalled()
  })

  it('rethrows ConditionalCheckFailedException as BusinessError 409', async () => {
    const err = Object.assign(new Error('Conditional check failed'), {
      code: 'ConditionalCheckFailedException',
    })
    mockSeatRepo.holdSeat.mockRejectedValue(err)
    await expect(service.holdSeat(SHOW, SEAT, USER)).rejects.toMatchObject({
      statusCode: 409,
    })
  })

  it('does NOT fail the hold when WS broadcast throws', async () => {
    mockWs.broadcast.mockRejectedValue(new Error('ws-server down'))
    const result = await service.holdSeat(SHOW, SEAT, USER)
    expect(result.success).toBe(true)  // hold still succeeds
  })

  it('does NOT fail the hold when createBooking (PostgreSQL) throws', async () => {
    mockBookingRepo.createBooking.mockRejectedValue(new Error('postgres down'))
    const result = await service.holdSeat(SHOW, SEAT, USER)
    expect(result.success).toBe(true)  // DynamoDB hold is already committed
    expect(mockSeatRepo.holdSeat).toHaveBeenCalled()
    expect(mockRedisRepo.setHold).toHaveBeenCalled()
  })
})

// ── releaseHold ─────────────────────────────────────────────────────

describe('SeatService.releaseHold', () => {
  beforeEach(() => {
    mockSeatRepo.getSeat.mockResolvedValue({ held_by: USER, status: 'HELD' } as any)
    mockSeatRepo.releaseSeat.mockResolvedValue(undefined)
    mockRedisRepo.delHold.mockResolvedValue(undefined)
    mockWs.broadcast.mockResolvedValue(undefined)
    mockBookingRepo.getActiveHoldByUser.mockResolvedValue({ id: 'bk-1' } as any)
    mockBookingRepo.updateBookingStatus.mockResolvedValue({} as any)
  })

  it('releases DynamoDB seat back to AVAILABLE', async () => {
    await service.releaseHold(SHOW, SEAT)
    expect(mockSeatRepo.releaseSeat).toHaveBeenCalledWith(SHOW, SEAT)
  })

  it('deletes Redis hold keys', async () => {
    await service.releaseHold(SHOW, SEAT)
    expect(mockRedisRepo.delHold).toHaveBeenCalledWith(SHOW, SEAT, USER)
  })

  it('broadcasts AVAILABLE to show channel', async () => {
    await service.releaseHold(SHOW, SEAT)
    expect(mockWs.broadcast).toHaveBeenCalledWith(
      `show:${SHOW}`,
      expect.objectContaining({ seat_id: SEAT, status: 'AVAILABLE' })
    )
  })

  it('broadcasts HOLD_EXPIRED to user channel', async () => {
    await service.releaseHold(SHOW, SEAT)
    expect(mockWs.broadcast).toHaveBeenCalledWith(
      `user:${USER}`,
      expect.objectContaining({ type: 'HOLD_EXPIRED', seat_id: SEAT })
    )
  })

  it('no-ops gracefully when seat is not held (already released)', async () => {
    mockSeatRepo.getSeat.mockResolvedValue({ status: 'AVAILABLE', held_by: null } as any)
    await expect(service.releaseHold(SHOW, SEAT)).resolves.not.toThrow()
    expect(mockSeatRepo.releaseSeat).not.toHaveBeenCalled()
  })
})

// ── getSeatMap ───────────────────────────────────────────────────────

describe('SeatService.getSeatMap', () => {
  it('groups seats by row and strips held_by', async () => {
    mockSeatRepo.getSeatMap.mockResolvedValue([
      { seat_id: 'A1', row: 'A', number: '1', status: 'AVAILABLE', tier_id: 't1', held_by: null } as any,
      { seat_id: 'A2', row: 'A', number: '2', status: 'HELD', tier_id: 't1', held_by: USER } as any,
    ])

    const result = await service.getSeatMap(SHOW)
    expect(result.show_id).toBe(SHOW)
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0].row).toBe('A')
    // held_by must not be exposed to the client
    expect(result.rows[0].seats[1]).not.toHaveProperty('held_by')
  })
})
