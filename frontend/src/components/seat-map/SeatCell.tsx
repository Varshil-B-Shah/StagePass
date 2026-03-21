import React from 'react'
import type { Seat, SeatStatus } from '@/types/seat.types'

const SEAT_SIZE = 22
const SEAT_GAP = 4
const OFFSET_X = 16
const OFFSET_Y = 16

// Maps status to SVG fill colour
const STATUS_FILL: Record<SeatStatus, string> = {
  AVAILABLE: '#4ade80',   // green-400
  HELD:      '#9ca3af',   // gray-400
  RESERVED:  '#9ca3af',   // gray-400 (same as held)
  BOOKED:    '#374151',   // gray-700
  BLOCKED:   '#fca5a5',   // red-300
}

const MY_HOLD_FILL = '#60a5fa' // blue-400

interface SeatCellProps {
  seat: Seat
  isMyHold?: boolean
  onClick: () => void
}

export const SeatCell: React.FC<SeatCellProps> = ({ seat, isMyHold = false, onClick }) => {
  const isClickable = seat.status === 'AVAILABLE'

  // Derive pixel position from row letter and seat number
  const col = parseInt(seat.number, 10) - 1
  const row = seat.row.toUpperCase().charCodeAt(0) - 65 // 'A' = 0
  const x = OFFSET_X + col * (SEAT_SIZE + SEAT_GAP)
  const y = OFFSET_Y + row * (SEAT_SIZE + SEAT_GAP)

  const fill = isMyHold ? MY_HOLD_FILL : (STATUS_FILL[seat.status] ?? '#9ca3af')

  return (
    <rect
      x={x}
      y={y}
      width={SEAT_SIZE}
      height={SEAT_SIZE}
      rx={3}
      fill={fill}
      style={{ cursor: isClickable ? 'pointer' : 'not-allowed' }}
      onClick={isClickable ? onClick : undefined}
      role="img"
      aria-label={`Seat ${seat.id} ${isMyHold ? 'your hold' : seat.status.toLowerCase()}`}
      data-testid={`seat-${seat.id}`}
      data-status={seat.status}
    />
  )
}
