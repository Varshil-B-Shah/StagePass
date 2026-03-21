import { SeatRepository } from '../repositories/seat.repository'
import { BookingRepository } from '../repositories/booking.repository'
import { RedisRepository } from '../repositories/redis.repository'
import { IWsService } from './ws.service'

export interface CheckoutInput {
  user_id: string
  show_id: string
  seat_id: string
  event_id: string
}

export interface CheckoutResult {
  booking_id: string
  show_id: string
}

export class BookingService {
  constructor(
    private readonly seatRepo: SeatRepository,
    private readonly bookingRepo: BookingRepository,
    private readonly redisRepo: RedisRepository,
    private readonly ws: IWsService
  ) {}

  async confirm(booking_id: string, razorpay_order_id: string): Promise<void> {
    const booking = await this.bookingRepo.getBookingById(booking_id)
    if (!booking) throw Object.assign(new Error('Booking not found'), { status: 404 })

    await this.bookingRepo.confirmBooking(booking_id, razorpay_order_id)

    // Update each seat RESERVED → BOOKED in DynamoDB and broadcast via WS
    await Promise.allSettled(
      booking.seats.map(async (seat_id) => {
        await this.seatRepo.confirmReservedSeat(booking.show_id, seat_id).catch(() => {})
        this.ws.broadcast(`show:${booking.show_id}`, { seat_id, status: 'BOOKED' }).catch(() => {})
      })
    )
  }

  async expire(booking_id: string): Promise<void> {
    await this.bookingRepo.expireBooking(booking_id)
  }

  async getById(booking_id: string): Promise<import('../repositories/booking.repository').Booking | null> {
    return this.bookingRepo.getBookingById(booking_id)
  }

  async release(booking_id: string, user_id: string): Promise<void> {
    const booking = await this.bookingRepo.getBookingById(booking_id)
    if (!booking) throw Object.assign(new Error('Booking not found'), { status: 404 })
    if (booking.user_id !== user_id) throw Object.assign(new Error('Forbidden'), { status: 403 })
    if (booking.status !== 'RESERVED') return // already resolved, nothing to do

    const seat_id = booking.seats[0]
    // releaseReservedSeat has ConditionExpression: status = RESERVED.
    // If the webhook already confirmed the seat (BOOKED), this throws — we capture
    // that result so we only broadcast AVAILABLE when the seat was truly released.
    const seatReleased = await this.seatRepo.releaseReservedSeat(booking.show_id, seat_id)
      .then(() => true)
      .catch(() => false)

    await Promise.all([
      this.redisRepo.delHold(booking.show_id, seat_id, user_id).catch(() => {}),
      this.bookingRepo.updateBookingStatus(booking_id, 'FAILED'),
    ])

    // Only broadcast AVAILABLE if DynamoDB was actually updated.
    // If the seat is already BOOKED (ondismiss race after successful payment),
    // we must NOT broadcast AVAILABLE — that would mislead other users' frontends.
    if (seatReleased) {
      this.ws.broadcast(`show:${booking.show_id}`, { seat_id, status: 'AVAILABLE' }).catch(() => {})
    }
  }

  async getMyBookings(user_id: string): Promise<import('../repositories/booking.repository').Booking[]> {
    return this.bookingRepo.getBookingsByUser(user_id)
  }

  async checkout(input: CheckoutInput): Promise<CheckoutResult> {
    const { user_id, show_id, seat_id } = input

    // Verify the user has an active hold on this seat in Redis
    const holdExists = await this.redisRepo.holdExists(show_id, seat_id, user_id)
    if (!holdExists) {
      throw Object.assign(new Error('No active hold found for this seat'), { status: 409 })
    }

    // Atomically transition seat HELD → RESERVED in DynamoDB
    try {
      await this.seatRepo.reserveSeat(show_id, seat_id, user_id)
    } catch (err: unknown) {
      const awsErr = err as { code?: string }
      if (awsErr.code === 'ConditionalCheckFailedException') {
        throw Object.assign(new Error('Seat is no longer held by this user'), { status: 409 })
      }
      throw err
    }

    // Find the active HOLD booking record for this user+show
    const holdBooking = await this.bookingRepo.getActiveHoldByUser(user_id, show_id)
    if (!holdBooking) {
      // Roll back DynamoDB reservation if booking record not found
      await this.seatRepo.releaseSeat(show_id, seat_id).catch(() => {})
      throw Object.assign(new Error('Booking record not found'), { status: 404 })
    }

    // Clear Redis hold key — seat is now RESERVED in DynamoDB.
    // Without this the key would expire later and the subscriber would attempt
    // (and safely no-op) a release on a RESERVED/BOOKED seat, but it's cleaner
    // to remove it here so expiry events only ever fire for actual HELD seats.
    await this.redisRepo.delHold(show_id, seat_id, user_id).catch(() => {})

    // Update booking status to RESERVED
    const booking = await this.bookingRepo.reserveBooking(holdBooking.id)

    return { booking_id: booking.id, show_id }
  }
}
