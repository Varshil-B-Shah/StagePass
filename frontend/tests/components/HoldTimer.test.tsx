/** @jest-environment jsdom */
import React from 'react'
import { render, screen, act } from '@testing-library/react'
import { HoldTimer } from '../../src/components/seat-map/HoldTimer'

describe('HoldTimer', () => {
  beforeEach(() => jest.useFakeTimers())
  afterEach(() => jest.useRealTimers())

  it('renders the initial seconds remaining', () => {
    const expireAt = new Date(Date.now() + 60_000)
    render(<HoldTimer expireAt={expireAt} onExpire={() => {}} />)
    expect(screen.getByText(/expire in 60s/i)).toBeInTheDocument()
  })

  it('decrements the countdown each second', () => {
    const expireAt = new Date(Date.now() + 60_000)
    render(<HoldTimer expireAt={expireAt} onExpire={() => {}} />)

    act(() => { jest.advanceTimersByTime(3_000) })

    expect(screen.getByText(/expire in 57s/i)).toBeInTheDocument()
  })

  it('calls onExpire when countdown reaches zero', () => {
    const onExpire = jest.fn()
    const expireAt = new Date(Date.now() + 2_000)
    render(<HoldTimer expireAt={expireAt} onExpire={onExpire} />)

    act(() => { jest.advanceTimersByTime(3_000) })

    expect(onExpire).toHaveBeenCalledTimes(1)
  })
})
