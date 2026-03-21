export type SeatStatus = 'AVAILABLE' | 'HELD' | 'RESERVED' | 'BOOKED' | 'BLOCKED'

export interface Seat {
  id: string
  row: string
  number: string
  status: SeatStatus
  tier_id: string
}

export interface SeatRow {
  row: string
  seats: Seat[]
}

export interface SeatMap {
  show_id: string
  rows: SeatRow[]
}
