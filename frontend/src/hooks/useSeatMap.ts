'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import type { SeatMap } from '@/types/seat.types'

export function useSeatMap(show_id: string) {
  const [seatMap, setSeatMap] = useState<SeatMap | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [heldSeat, setHeldSeat] = useState<string | null>(null)
  const [holdExpiresAt, setHoldExpiresAt] = useState<number | null>(null)

  const ws = useRef<WebSocket | null>(null)
  const reconnectDelay = useRef(1000)
  const reconnectTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchSeatMap = useCallback(async () => {
    try {
      const res = await fetch(`/api/events/${encodeURIComponent(show_id)}/seats`)
      if (!res.ok) throw new Error(`Seat map fetch failed: ${res.status}`)
      const data: SeatMap = await res.json()
      setSeatMap(data)
      setLoading(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load seats')
      setLoading(false)
    }
  }, [show_id])

  // Initial REST fetch + restore any active hold on mount (survives page refresh)
  useEffect(() => {
    fetchSeatMap()

    fetch(`/api/events/${encodeURIComponent(show_id)}/user-holds`)
      .then((r) => r.json())
      .then((data: { holds?: Array<{ seat_id: string; expires_at: number }> }) => {
        const hold = data.holds?.[0]
        if (hold && hold.expires_at > Date.now()) {
          setHeldSeat(hold.seat_id)
          setHoldExpiresAt(hold.expires_at)
        }
      })
      .catch(() => {})
  }, [show_id, fetchSeatMap])

  // WebSocket connection lifecycle
  useEffect(() => {
    let active = true  // guard against stale closures after unmount

    const connectWs = async () => {
      if (!active) return
      try {
        const authRes = await fetch('/api/ws/auth')
        if (!authRes.ok) return   // unauthenticated — do not reconnect
        const { token } = await authRes.json() as { token: string }

        if (!active) return  // unmounted while awaiting auth

        // Note: show_id is NOT in the URL to avoid encoding issues.
        // The subscribe message is sent in onopen instead.
        const wsUrl = `${process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:4000'}?token=${token}`
        const socket = new WebSocket(wsUrl)
        ws.current = socket

        socket.onopen = () => {
          reconnectDelay.current = 1000
          // Use local `socket` ref — ws.current may point to a newer socket
          // if React StrictMode double-invoked this effect.
          socket.send(JSON.stringify({ action: 'subscribe', channel: `show:${show_id}` }))
          // Re-fetch after subscribing to catch any updates missed between the
          // initial REST fetch and this WS subscription being registered.
          fetchSeatMap()
        }

        socket.onmessage = (event) => {
          const payload = JSON.parse(event.data as string) as {
            type?: string
            seat_id?: string
            status?: string
          }

          if (payload.type === 'HOLD_EXPIRED' || payload.type === 'HOLD_RELEASED') {
            // Personal channel notification — clear local hold UI
            setHeldSeat(null)
            setHoldExpiresAt(null)
          } else if (payload.seat_id && payload.status) {
            // Show channel notification — update single seat in map
            setSeatMap((prev) => {
              if (!prev) return prev
              return {
                ...prev,
                rows: prev.rows.map((row) => ({
                  ...row,
                  seats: row.seats.map((seat) =>
                    seat.id === payload.seat_id
                      ? { ...seat, status: payload.status as 'AVAILABLE' | 'HELD' | 'BOOKED' | 'BLOCKED' }
                      : seat
                  ),
                })),
              }
            })
          }
        }

        socket.onerror = () => {
          // Errors are handled in onclose (WS always closes after error)
        }

        socket.onclose = () => {
          if (!active) return  // component unmounted — skip refetch and reconnect

          // Re-fetch seat map to catch any missed updates while disconnected
          fetchSeatMap()

          // Reconnect with exponential backoff (cap at 8 s)
          reconnectTimeout.current = setTimeout(() => {
            reconnectDelay.current = Math.min(reconnectDelay.current * 2, 8_000)
            connectWs()
          }, reconnectDelay.current)
        }
      } catch {
        if (!active) return
        // Retry on connection failure
        reconnectTimeout.current = setTimeout(() => {
          reconnectDelay.current = Math.min(reconnectDelay.current * 2, 8_000)
          connectWs()
        }, reconnectDelay.current)
      }
    }

    connectWs()

    return () => {
      active = false  // prevent stale onclose/reconnect after unmount
      if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current)
      if (ws.current) {
        ws.current.onclose = null
        ws.current.close()
        ws.current = null
      }
    }
  }, [show_id, fetchSeatMap])

  const holdSeat = async (seatId: string) => {
    const res = await fetch('/api/bookings/hold', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ show_id, seat_id: seatId }),
    })

    if (!res.ok) {
      const err = await res.json() as { error: string }
      throw Object.assign(new Error(err.error), { status: res.status })
    }

    const data = await res.json() as { success: boolean; expires_at: number | string }
    // Normalise to Unix ms — the API may return a number (ms) or ISO string
    const expiresAtMs =
      typeof data.expires_at === 'number'
        ? data.expires_at
        : new Date(data.expires_at).getTime()
    setHeldSeat(seatId)
    setHoldExpiresAt(expiresAtMs)
    return { ...data, expires_at: expiresAtMs }
  }

  const clearHold = useCallback(async () => {
    const seatId = heldSeat
    setHeldSeat(null)
    setHoldExpiresAt(null)

    if (seatId) {
      // Explicitly release the hold on the backend — this triggers a WS broadcast
      // so all other clients (User 2, etc.) see the seat go green immediately.
      fetch('/api/bookings/hold', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ show_id, seat_id: seatId }),
      }).catch(() => {})
    }

    fetchSeatMap()
  }, [show_id, heldSeat, fetchSeatMap])

  return { seatMap, loading, error, heldSeat, holdExpiresAt, holdSeat, clearHold }
}
