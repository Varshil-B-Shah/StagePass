'use client'
import { useEffect, useState } from 'react'

interface StreamStatusBannerProps {
  status: 'UPCOMING' | 'LIVE' | 'ENDED' | 'VOD_AVAILABLE'
  went_live_at?: number | null
}

export function StreamStatusBanner({ status, went_live_at }: StreamStatusBannerProps) {
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  if (status === 'LIVE') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
        LIVE
        {went_live_at && (
          <span className="text-red-400 font-normal ml-1">
            · {formatElapsed(now - went_live_at * 1000)}
          </span>
        )}
      </span>
    )
  }

  if (status === 'UPCOMING') {
    return (
      <span className="text-sm text-gray-500">Stream hasn't started yet — check back soon</span>
    )
  }

  if (status === 'ENDED') {
    return <span className="text-sm text-gray-500">Stream has ended</span>
  }

  if (status === 'VOD_AVAILABLE') {
    return (
      <span className="text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
        VOD · Recording
      </span>
    )
  }

  return null
}

function formatElapsed(ms: number): string {
  const s = Math.floor(ms / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  return `${m}:${String(sec).padStart(2, '0')}`
}
