import { Pool } from 'pg'

export class BookingRepository {
  constructor(private readonly pool: Pool) {}

  /** Returns true if the user has a CONFIRMED booking for this event */
  async hasConfirmedBooking(user_id: string, event_id: string): Promise<boolean> {
    const result = await this.pool.query(
      `SELECT id FROM "Booking" WHERE user_id = $1 AND event_id = $2 AND status = 'CONFIRMED' LIMIT 1`,
      [user_id, event_id]
    )
    return result.rowCount !== null && result.rowCount > 0
  }
}
