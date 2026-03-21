'use client'
import React from 'react'
import { useRouter } from 'next/navigation'
import { useSeatMap } from '@/hooks/useSeatMap'
import { SeatCell } from './SeatCell'
import { HoldTimer } from './HoldTimer'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

interface SeatMapProps {
  show_id: string
}

export const SeatMap: React.FC<SeatMapProps> = ({ show_id }) => {
  const router = useRouter()
  const { seatMap, loading, error, heldSeat, holdExpiresAt, holdSeat, clearHold } = useSeatMap(show_id)
  const event_id = show_id.split('#')[0]

  const handleSeatClick = async (seatId: string) => {
    try {
      await holdSeat(seatId)
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string }
      if (e.status === 409) {
        toast.error('Seat just taken — pick another')
      } else {
        toast.error(e.message ?? 'Something went wrong')
      }
    }
  }

  if (loading) {
    return <div className="text-gray-500 py-8 text-center">Loading seat map…</div>
  }

  if (error) {
    return <div className="text-red-600 py-8 text-center">{error}</div>
  }

  if (!seatMap) return null

  // Calculate SVG dimensions from the seat map data
  const maxSeatsPerRow = Math.max(...seatMap.rows.map((r) => r.seats.length))
  const svgWidth = 16 + maxSeatsPerRow * 26 + 16
  const svgHeight = 16 + seatMap.rows.length * 26 + 16

  return (
    <div className="flex flex-col items-center gap-4">
      {heldSeat && holdExpiresAt && (
        <div className="flex flex-col items-center gap-3 rounded bg-blue-50 px-4 py-3 text-sm w-full max-w-xs">
          <div className="flex items-center gap-3">
            <span className="font-medium text-blue-700">Seat {heldSeat} held —</span>
            <HoldTimer
              expireAt={new Date(holdExpiresAt)}
              onExpire={clearHold}
            />
          </div>
          <Button
            className="w-full"
            onClick={() => router.push(`/checkout?show_id=${encodeURIComponent(show_id)}&seat_id=${encodeURIComponent(heldSeat)}&event_id=${encodeURIComponent(event_id)}`)}
          >
            Proceed to Checkout
          </Button>
        </div>
      )}

      <svg
        width={svgWidth}
        height={svgHeight}
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        aria-label="Seat map"
      >
        {seatMap.rows.flatMap((row) =>
          row.seats.map((seat) => (
            <SeatCell
              key={seat.id}
              seat={seat}
              isMyHold={seat.id === heldSeat}
              onClick={() => handleSeatClick(seat.id)}
            />
          ))
        )}
      </svg>

      <div className="flex gap-4 text-xs text-gray-600">
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded bg-green-400" /> Available
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded bg-gray-400" /> Held
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded bg-blue-400" /> Your hold
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded bg-gray-700" /> Booked
        </span>
      </div>
    </div>
  )
}
