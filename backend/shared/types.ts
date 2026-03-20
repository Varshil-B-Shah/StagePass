// Seat states
export type SeatStatus = 'AVAILABLE' | 'HELD' | 'BOOKED' | 'BLOCKED'

// A single seat as stored/returned by the booking service
export interface Seat {
  id: string             // e.g. "A12"
  row: string            // e.g. "A"
  number: string         // e.g. "12"
  status: SeatStatus
  tier_id: string
  held_by?: string | null
  hold_expires_at?: number | null  // Unix ms
}

// A row of seats as returned to the frontend (held_by omitted for privacy)
export interface SeatRow {
  row: string
  seats: Omit<Seat, 'held_by' | 'hold_expires_at'>[]
}

// Full seat map response
export interface SeatMapResponse {
  show_id: string
  rows: SeatRow[]
}

// What the Booking Service broadcasts to the WebSocket server
export interface WsBroadcastPayload {
  seat_id: string
  status: SeatStatus
  held_by?: string
}

// What the WebSocket server sends to the holding user's personal channel
export interface WsUserPayload {
  type: 'HOLD_EXPIRED' | 'HOLD_RELEASED'
  seat_id: string
}

// POST /hold request body
export interface HoldRequest {
  show_id: string
  seat_id: string
}

// POST /hold response
export interface HoldResponse {
  success: boolean
  expires_at: number  // Unix ms
}
