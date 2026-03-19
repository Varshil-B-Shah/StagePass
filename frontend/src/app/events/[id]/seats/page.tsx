'use client'
import { SeatMap } from '@/components/seat-map/SeatMap'

interface SeatsPageProps {
  params: { id: string }
}

export default function SeatsPage({ params }: SeatsPageProps) {
  // params.id is the show_id (e.g. "EVT-001#2025-04-01#19:00")
  const showId = decodeURIComponent(params.id)

  return (
    <main className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-2xl font-bold mb-6">Select your seat</h1>
      <SeatMap show_id={showId} />
    </main>
  )
}
