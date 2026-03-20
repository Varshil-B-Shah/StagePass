import { SeatRepository } from '../repositories/seat.repository'
import { BookingRepository } from '../repositories/booking.repository'
import { RedisRepository } from '../repositories/redis.repository'

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
    private readonly redisRepo: RedisRepository
  ) {}

  async confirm(booking_id: string, razorpay_order_id: string): Promise<void> {
    await this.bookingRepo.confirmBooking(booking_id, razorpay_order_id)
  }

  async expire(booking_id: string): Promise<void> {
    await this.bookingRepo.expireBooking(booking_id)
  }

  async getById(booking_id: string): Promise<import('../repositories/booking.repository').Booking | null> {
    return this.bookingRepo.getBookingById(booking_id)
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

    // Update booking status to RESERVED
    const booking = await this.bookingRepo.reserveBooking(holdBooking.id)

    return { booking_id: booking.id, show_id }
  }
}
