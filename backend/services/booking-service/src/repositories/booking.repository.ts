import { PrismaClient } from '@prisma/client'
import { randomUUID } from 'crypto'

type BookingStatus = 'HOLD' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED'

/** Mirrors the Booking model in prisma/schema.prisma.
 *  Once `prisma generate` has run this type will be available from @prisma/client directly.
 *  Defined locally so the file compiles before the Prisma client is generated. */
export interface Booking {
  id: string
  user_id: string
  event_id: string
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
  seat_ids: string[]
  held_until: Date
  // show_id is not stored in PostgreSQL in Phase 1 (no show_id column on Booking).
  // DynamoDB is the source of truth for real-time seat state per show.
  // Phase 2 will add show_id to the Booking schema when payment correlation is needed.
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
        seats: input.seat_ids,
        status: 'HOLD',
        held_until: input.held_until,
      },
    }) as Promise<Booking>
  }

  /** Returns the most recent active hold for a user across any show.
   *  Phase 1: one hold per user at a time (enforced by Redis duplicate-hold guard in SeatService).
   *  Phase 2: add show_id column to Booking and filter here for per-show precision. */
  async getActiveHoldByUser(user_id: string): Promise<Booking | null> {
    return this.db.booking.findFirst({
      where: {
        user_id,
        status: 'HOLD',
        held_until: { gt: new Date() },
      },
      orderBy: { created_at: 'desc' },
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
}
