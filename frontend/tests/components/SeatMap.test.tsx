/** @jest-environment jsdom */
import React from 'react'
import { render, screen } from '@testing-library/react'
import { SeatMap } from '../../src/components/seat-map/SeatMap'

// Mock useSeatMap so SeatMap tests stay isolated from hook behaviour
jest.mock('../../src/hooks/useSeatMap', () => ({
  useSeatMap: jest.fn(),
}))
import { useSeatMap } from '../../src/hooks/useSeatMap'
const mockUseSeatMap = useSeatMap as jest.MockedFunction<typeof useSeatMap>

const MOCK_SEAT_MAP = {
  show_id: 'EVT-001#2025-04-01#19:00',
  rows: [
    {
      row: 'A',
      seats: [
        { id: 'A1', row: 'A', number: '1', status: 'AVAILABLE' as const, tier_id: 't1' },
        { id: 'A2', row: 'A', number: '2', status: 'HELD' as const, tier_id: 't1' },
      ],
    },
  ],
}

describe('SeatMap', () => {
  it('renders a SeatCell for every seat in the map', () => {
    mockUseSeatMap.mockReturnValue({
      seatMap: MOCK_SEAT_MAP,
      loading: false,
      error: null,
      heldSeat: null,
      holdExpiresAt: null,
      holdSeat: jest.fn(),
    })

    render(<SeatMap show_id="EVT-001#2025-04-01#19:00" />)

    expect(screen.getByTestId('seat-A1')).toBeInTheDocument()
    expect(screen.getByTestId('seat-A2')).toBeInTheDocument()
  })

  it('shows a loading message while the seat map is loading', () => {
    mockUseSeatMap.mockReturnValue({
      seatMap: null,
      loading: true,
      error: null,
      heldSeat: null,
      holdExpiresAt: null,
      holdSeat: jest.fn(),
    })

    render(<SeatMap show_id="EVT-001#2025-04-01#19:00" />)

    expect(screen.getByText(/loading seat map/i)).toBeInTheDocument()
  })
})
