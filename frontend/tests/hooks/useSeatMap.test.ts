/** @jest-environment jsdom */
import { renderHook, act, waitFor } from '@testing-library/react'
import fetchMock from 'jest-fetch-mock'
import { useSeatMap } from '../../src/hooks/useSeatMap'

const SHOW_ID = 'EVT-001#2025-04-01#19:00'

process.env.NEXT_PUBLIC_WS_URL = 'ws://localhost:4000'

// ── Manual WebSocket mock ─────────────────────────────────────────────────────
let latestWs: MockWebSocket

class MockWebSocket {
  static OPEN = 1
  url: string
  readyState = MockWebSocket.OPEN
  onopen: (() => void) | null = null
  onmessage: ((e: { data: string }) => void) | null = null
  onclose: (() => void) | null = null
  onerror: ((e: Event) => void) | null = null

  constructor(url: string) {
    this.url = url
    latestWs = this
    // Simulate async open — fire after current microtask queue drains
    Promise.resolve().then(() => this.onopen?.())
  }

  send(_data: string) { /* captured by tests if needed */ }
  close() { this.onclose?.() }

  /** Helper: push a raw JSON string into the hook as if ws-server sent it */
  simulateMessage(payload: object) {
    this.onmessage?.({ data: JSON.stringify(payload) })
  }
}

// Replace global WebSocket before any test runs
;(global as unknown as { WebSocket: typeof MockWebSocket }).WebSocket = MockWebSocket
// ─────────────────────────────────────────────────────────────────────────────

const SEAT_MAP_RESPONSE = {
  show_id: SHOW_ID,
  rows: [
    {
      row: 'A',
      seats: [
        { id: 'A1', row: 'A', number: '1', status: 'AVAILABLE', tier_id: 'tier-1' },
        { id: 'A2', row: 'A', number: '2', status: 'AVAILABLE', tier_id: 'tier-1' },
      ],
    },
  ],
}

function setupFetchMocks() {
  fetchMock.resetMocks()
  // Call order: 1) fetchSeatMap (REST) on mount, 2) ws/auth on WS connect
  fetchMock.mockResponseOnce(JSON.stringify(SEAT_MAP_RESPONSE))
  fetchMock.mockResponseOnce(JSON.stringify({ token: 'mock-ws-token', expires_in: 3600 }))
}

describe('useSeatMap', () => {
  beforeEach(setupFetchMocks)

  it('fetches and exposes the seat map on mount', async () => {
    const { result } = renderHook(() => useSeatMap(SHOW_ID))

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.seatMap?.rows[0].seats).toHaveLength(2)
    expect(result.current.seatMap?.rows[0].seats[0].status).toBe('AVAILABLE')
    expect(result.current.error).toBeNull()
  })

  it('updates a single seat status when a show-channel message arrives', async () => {
    const { result } = renderHook(() => useSeatMap(SHOW_ID))
    await waitFor(() => expect(result.current.loading).toBe(false))

    // Wait for the WS connection to open and the hook to wire up onmessage
    await waitFor(() => expect(latestWs.onmessage).not.toBeNull())

    act(() => {
      latestWs.simulateMessage({ seat_id: 'A1', status: 'HELD' })
    })

    const seat = result.current.seatMap?.rows[0].seats.find((s) => s.id === 'A1')
    expect(seat?.status).toBe('HELD')
    // A2 must not change
    const a2 = result.current.seatMap?.rows[0].seats.find((s) => s.id === 'A2')
    expect(a2?.status).toBe('AVAILABLE')
  })

  it('sets heldSeat when holdSeat() is called successfully', async () => {
    fetchMock.mockResponseOnce(JSON.stringify({ success: true, expires_at: Date.now() + 60_000 }))
    const { result } = renderHook(() => useSeatMap(SHOW_ID))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.holdSeat('A1')
    })

    expect(result.current.heldSeat).toBe('A1')
    expect(result.current.holdExpiresAt).toBeDefined()
  })

  it('clears heldSeat on HOLD_EXPIRED WS message', async () => {
    fetchMock.mockResponseOnce(JSON.stringify({ success: true, expires_at: Date.now() + 60_000 }))
    const { result } = renderHook(() => useSeatMap(SHOW_ID))
    await waitFor(() => expect(result.current.loading).toBe(false))

    // Hold a seat first
    await act(async () => { await result.current.holdSeat('A1') })
    expect(result.current.heldSeat).toBe('A1')

    // Wait for WS onmessage to be wired
    await waitFor(() => expect(latestWs.onmessage).not.toBeNull())

    // Server sends HOLD_EXPIRED on user personal channel
    act(() => {
      latestWs.simulateMessage({ type: 'HOLD_EXPIRED', seat_id: 'A1' })
    })

    expect(result.current.heldSeat).toBeNull()
  })
})
