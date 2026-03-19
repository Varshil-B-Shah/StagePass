/** @jest-environment jsdom */
import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SeatCell } from '../../src/components/seat-map/SeatCell'
import type { Seat } from '../../src/types/seat.types'

function makeSeat(overrides: Partial<Seat> = {}): Seat {
  return { id: 'A1', row: 'A', number: '1', status: 'AVAILABLE', tier_id: 'tier-1', ...overrides }
}

describe('SeatCell', () => {
  it('renders with the seat id as aria-label', () => {
    render(
      <svg>
        <SeatCell seat={makeSeat()} onClick={() => {}} />
      </svg>
    )
    expect(screen.getByRole('img', { name: /seat a1/i })).toBeInTheDocument()
  })

  it('calls onClick when an AVAILABLE seat is clicked', async () => {
    const handleClick = jest.fn()
    render(
      <svg>
        <SeatCell seat={makeSeat({ status: 'AVAILABLE' })} onClick={handleClick} />
      </svg>
    )
    await userEvent.click(screen.getByRole('img', { name: /seat a1/i }))
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('does not call onClick when seat is HELD', async () => {
    const handleClick = jest.fn()
    render(
      <svg>
        <SeatCell seat={makeSeat({ status: 'HELD' })} onClick={handleClick} />
      </svg>
    )
    await userEvent.click(screen.getByRole('img', { name: /seat a1/i }))
    expect(handleClick).not.toHaveBeenCalled()
  })
})
