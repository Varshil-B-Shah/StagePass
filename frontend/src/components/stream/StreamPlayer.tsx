'use client'
import { useEffect, useRef } from 'react'
import { Room, RoomEvent, Track } from 'livekit-client'

interface StreamPlayerProps {
  token: string
}

export function StreamPlayer({ token }: StreamPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    const room = new Room()

    room.on(RoomEvent.TrackSubscribed, (track) => {
      if (track.kind === Track.Kind.Video && videoRef.current) {
        track.attach(videoRef.current)
      }
      if (track.kind === Track.Kind.Audio && audioRef.current) {
        track.attach(audioRef.current)
      }
    })

    room.on(RoomEvent.TrackUnsubscribed, (track) => {
      track.detach()
    })

    const wsUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL ?? 'wss://localhost:7880'
    room.connect(wsUrl, token, { autoSubscribe: true }).catch(() => {})

    return () => {
      room.disconnect()
    }
  }, [token])

  return (
    <>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        controls
        className="w-full aspect-video bg-black rounded"
      />
      <audio ref={audioRef} autoPlay />
    </>
  )
}
