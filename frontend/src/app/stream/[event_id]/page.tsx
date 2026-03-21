'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { StreamPlayer } from '@/components/stream/StreamPlayer'
import { ChatPanel } from '@/components/stream/ChatPanel'
import { StreamStatusBanner } from '@/components/stream/StreamStatusBanner'

interface StreamStatus {
  status: 'UPCOMING' | 'LIVE' | 'ENDED' | 'VOD_AVAILABLE'
  went_live_at: number | null
  vod_url: string | null
}

interface PlaybackToken {
  token: string
}

export default function StreamPage({ params }: { params: { event_id: string } }) {
  const { event_id } = params
  const router = useRouter()

  const [streamStatus, setStreamStatus] = useState<StreamStatus | null>(null)
  const [playbackToken, setPlaybackToken] = useState<PlaybackToken | null>(null)
  const [tokenError, setTokenError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchStatus = useCallback(async () => {
    const res = await fetch(`/api/streams/${encodeURIComponent(event_id)}`).catch(() => null)
    if (!res?.ok) return
    const data: StreamStatus = await res.json()
    setStreamStatus(data)
    setLoading(false)
  }, [event_id])

  const fetchToken = useCallback(async () => {
    const res = await fetch(`/api/streams/${encodeURIComponent(event_id)}/token`).catch(() => null)
    if (!res) return
    if (res.status === 401) { router.push('/auth'); return }
    if (res.status === 403) { setTokenError('no-booking'); return }
    if (!res.ok) return
    const data: PlaybackToken = await res.json()
    setPlaybackToken(data)
  }, [event_id, router])

  useEffect(() => { fetchStatus() }, [fetchStatus])

  useEffect(() => {
    if (!streamStatus) return
    if (streamStatus.status !== 'UPCOMING' && streamStatus.status !== 'LIVE') return
    const id = setInterval(fetchStatus, 10_000)
    return () => clearInterval(id)
  }, [streamStatus, fetchStatus])

  useEffect(() => {
    if (streamStatus?.status === 'LIVE' || streamStatus?.status === 'VOD_AVAILABLE') {
      if (!playbackToken) fetchToken()
    }
  }, [streamStatus, playbackToken, fetchToken])

  if (loading) {
    return <div className="text-center py-20 text-gray-500">Loading stream…</div>
  }

  if (!streamStatus) {
    return <div className="text-center py-20 text-red-500">Stream not found</div>
  }

  if (tokenError === 'no-booking') {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16 text-center">
        <div className="text-4xl mb-4">🔒</div>
        <h1 className="text-xl font-semibold mb-2">Ticket required to watch</h1>
        <p className="text-gray-500 mb-6">Purchase a ticket to access the live stream.</p>
        <a href={`/events/${event_id}`} className="text-indigo-600 hover:underline">
          View event →
        </a>
      </main>
    )
  }

  const { status, went_live_at, vod_url } = streamStatus

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <div className="flex items-center gap-3 mb-4">
        <h1 className="text-xl font-bold">Live Stream</h1>
        <StreamStatusBanner status={status} went_live_at={went_live_at} />
      </div>

      {status === 'UPCOMING' && (
        <div className="py-20 text-center text-gray-500">
          <div className="text-5xl mb-4">📺</div>
          <p className="text-lg">Stream hasn't started yet.</p>
          <p className="text-sm mt-2">This page will update automatically when the stream goes live.</p>
        </div>
      )}

      {status === 'ENDED' && (
        <div className="py-20 text-center text-gray-500">
          <div className="text-5xl mb-4">📺</div>
          <p className="text-lg">Stream has ended.</p>
          {!vod_url && <p className="text-sm mt-2">A recording will be available shortly.</p>}
        </div>
      )}

      {status === 'VOD_AVAILABLE' && vod_url && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4" style={{ height: '70vh' }}>
          <div className="lg:col-span-2">
            <video src={vod_url} controls className="w-full aspect-video bg-black rounded" />
          </div>
          <div className="flex flex-col min-h-0 h-full">
            <ChatPanel event_id={event_id} readOnly />
          </div>
        </div>
      )}

      {status === 'LIVE' && playbackToken && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4" style={{ height: '70vh' }}>
          <div className="lg:col-span-2 flex flex-col">
            <StreamPlayer token={playbackToken.token} />
          </div>
          <div className="flex flex-col min-h-0 h-full">
            <ChatPanel event_id={event_id} />
          </div>
        </div>
      )}

      {status === 'LIVE' && !playbackToken && (
        <div className="text-center py-20 text-gray-400">Loading player…</div>
      )}
    </main>
  )
}
