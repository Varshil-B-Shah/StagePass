import { SeatRepository, SeatItem } from '../repositories/seat.repository'
import { RedisRepository } from '../repositories/redis.repository'
import { BookingRepository } from '../repositories/booking.repository'
import { IWsService } from './ws.service'
import { BusinessError } from '../errors'
import type { SeatMapResponse } from '@stagepass/shared'

const HOLD_TTL_SECONDS = 60

export class SeatService {
  constructor(
    private readonly seatRepo: SeatRepository,
    private readonly redisRepo: RedisRepository,
    private readonly bookingRepo: BookingRepository,
    private readonly ws: IWsService
  ) {}

  async holdSeat(
    show_id: string,
    seat_id: string,
    user_id: string
  ): Promise<{ success: true; expires_at: number }> {
    // 1. Duplicate-hold guard (fast path via Redis)
    const existing = await this.redisRepo.getUserHolds(show_id, user_id)
    if (existing.length > 0) {
      throw new BusinessError('User already holds a seat for this show', 400)
    }

    const expires_at = Date.now() + HOLD_TTL_SECONDS * 1000

    try {
      // 2. Atomic conditional write — throws ConditionalCheckFailedException if taken
      await this.seatRepo.holdSeat({ show_id, seat_id, user_id, hold_expires_at: expires_at })
    } catch (err: any) {
      if (err.code === 'ConditionalCheckFailedException') {
        throw new BusinessError('Seat already taken', 409)
      }
      if (err.code === 'ProvisionedThroughputExceededException') {
        throw new BusinessError('Service busy, try again', 503)
      }
      throw err
    }

    // 3. Set Redis TTL (drives keyspace expiry notification)
    await this.redisRepo.setHold(show_id, seat_id, user_id, HOLD_TTL_SECONDS)

    // 4. Broadcast to show channel — best effort (seat is already reserved in DynamoDB)
    this.ws.broadcast(`show:${show_id}`, { seat_id, status: 'HELD', held_by: user_id }).catch(
      (err) => console.error('[WS] broadcast failed (hold):', err.message)
    )

    // 5. Record audit trail in PostgreSQL — best effort.
    this.bookingRepo.createBooking({
      user_id,
      event_id: show_id.split('#')[0],
      seat_ids: [seat_id],
      held_until: new Date(expires_at),
    }).catch((err) => console.error('[SeatService] createBooking failed (hold still valid):', err.message))

    return { success: true, expires_at }
  }

  async releaseHold(show_id: string, seat_id: string): Promise<void> {
    const seat = await this.seatRepo.getSeat(show_id, seat_id)
    if (!seat || seat.status !== 'HELD') return

    const user_id = seat.held_by!

    await this.seatRepo.releaseSeat(show_id, seat_id)
    await this.redisRepo.delHold(show_id, seat_id, user_id)

    const booking = await this.bookingRepo.getActiveHoldByUser(user_id)
    if (booking) {
      await this.bookingRepo.updateBookingStatus(booking.id, 'CANCELLED')
    }

    await Promise.allSettled([
      this.ws.broadcast(`show:${show_id}`, { seat_id, status: 'AVAILABLE' }),
      this.ws.broadcast(`user:${user_id}`, { type: 'HOLD_EXPIRED', seat_id }),
    ])
  }

  async getSeatMap(show_id: string): Promise<SeatMapResponse> {
    const seats = await this.seatRepo.getSeatMap(show_id)

    const rowMap = new Map<string, Array<{ id: string; row: string; number: string; status: SeatItem['status']; tier_id: string }>>()

    for (const seat of seats) {
      if (!rowMap.has(seat.row)) rowMap.set(seat.row, [])
      const { held_by, hold_expires_at, hold_expires_at_ttl, PK, SK, seat_id, ...rest } = seat
      rowMap.get(seat.row)!.push({ id: seat_id, ...rest })
    }

    return {
      show_id,
      rows: Array.from(rowMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([row, seats]) => ({
          row,
          seats: seats.sort((a, b) => Number(a.number) - Number(b.number)),
        })),
    }
  }

  async getUserHolds(show_id: string, user_id: string): Promise<string[]> {
    const redisHolds = await this.redisRepo.getUserHolds(show_id, user_id)
    if (redisHolds.length > 0) return redisHolds

    const dynamoHolds = await this.seatRepo.getUserHoldsFromDynamo(show_id, user_id)
    if (dynamoHolds.length === 0) return []

    for (const { seat_id, hold_expires_at } of dynamoHolds) {
      const remainingMs = hold_expires_at - Date.now()
      if (remainingMs <= 0) continue
      await this.redisRepo.setHold(show_id, seat_id, user_id, Math.ceil(remainingMs / 1000))
    }

    return dynamoHolds.map((h) => h.seat_id)
  }
}
