'use client'
import React, { useState, useEffect } from 'react'

interface HoldTimerProps {
  expireAt: Date
  onExpire: () => void
}

export const HoldTimer: React.FC<HoldTimerProps> = ({ expireAt, onExpire }) => {
  const [secondsLeft, setSecondsLeft] = useState(
    Math.max(0, Math.ceil((expireAt.getTime() - Date.now()) / 1000))
  )

  useEffect(() => {
    const interval = setInterval(() => {
      const left = Math.max(0, Math.ceil((expireAt.getTime() - Date.now()) / 1000))
      setSecondsLeft(left)
      if (left === 0) {
        clearInterval(interval)
        onExpire()
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [expireAt, onExpire])

  return (
    <div className="text-red-600 font-semibold text-sm">
      Expire in {secondsLeft}s
    </div>
  )
}
