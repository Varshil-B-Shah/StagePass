import { PrismaClient } from '@prisma/client'
import { randomUUID } from 'crypto'

type BookingStatus = 'HOLD' | 'RESERVED' | 'CONFIRMED' | 'FAILED' | 'COMPLETED' | 'CANCELLED'

/** Mirrors the Booking model in prisma/schema.prisma.
 *  Once `prisma generate` has run this type will be available from @prisma/client directly.
 *  Defined locally so the file compiles before the Prisma client is generated. */
export interface Booking {
  id: string
  user_id: string
  event_id: string
  show_id: string
  seats: string[]
  status: string
  held_until: Date | null
  payment_intent_id: string | null
  created_at: Date
  updated_at: Date
}

export interface CreateBookingInput {
  user_id: string
  event_id: string
  show_id: string
  seat_ids: string[]
  held_until: Date
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PrismaAny = any

export class BookingRepository {
  // Cast to any so this compiles before `prisma generate` has been run.
  // Once the Prisma client is generated, the cast can be removed and the
  // return types inferred directly from @prisma/client.
  private readonly db: PrismaAny

  constructor(prisma: PrismaClient) {
    this.db = prisma
  }

  async createBooking(input: CreateBookingInput): Promise<Booking> {
    return this.db.booking.create({
      data: {
        id: randomUUID(),
        user_id: input.user_id,
        event_id: input.event_id,
        show_id: input.show_id,
        seats: input.seat_ids,
        status: 'HOLD',
        held_until: input.held_until,
      },
    }) as Promise<Booking>
  }

  async getActiveHoldByUser(user_id: string, show_id: string): Promise<Booking | null> {
    return this.db.booking.findFirst({
      where: {
        user_id,
        show_id,
        status: 'HOLD',
        held_until: { gt: new Date() },
      },
      orderBy: { created_at: 'desc' },
    }) as Promise<Booking | null>
  }

  async reserveBooking(booking_id: string): Promise<Booking> {
    return this.db.booking.update({
      where: { id: booking_id },
      data: { status: 'RESERVED' },
    }) as Promise<Booking>
  }

  async confirmBooking(booking_id: string, razorpay_order_id: string): Promise<void> {
    await this.db.booking.update({
      where: { id: booking_id },
      data: { status: 'CONFIRMED', payment_intent_id: razorpay_order_id },
    })
  }

  async expireBooking(booking_id: string): Promise<void> {
    await this.db.booking.update({
      where: { id: booking_id },
      data: { status: 'FAILED' },
    })
  }

  async getBookingById(booking_id: string): Promise<Booking | null> {
    return this.db.booking.findUnique({
      where: { id: booking_id },
    }) as Promise<Booking | null>
  }

  async updateBookingStatus(
    booking_id: string,
    status: BookingStatus
  ): Promise<Booking> {
    return this.db.booking.update({
      where: { id: booking_id },
      data: { status },
    }) as Promise<Booking>
  }

  async getBookingsByUser(user_id: string): Promise<Booking[]> {
    return this.db.booking.findMany({
      where: { user_id, status: 'CONFIRMED' },
      orderBy: { created_at: 'desc' },
    }) as Promise<Booking[]>
  }
}
