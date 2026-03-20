import Link from 'next/link'
import type { Event } from '@/types/event.types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export const revalidate = 60   // ISR: revalidate every 60 seconds

async function getEvents(): Promise<Event[]> {
  const baseUrl = process.env.BOOKING_SERVICE_URL ?? 'http://localhost:3001'
  try {
    const res = await fetch(`${baseUrl}/api/events`, { next: { revalidate: 60 } })
    if (!res.ok) return []
    const data = await res.json()
    return data.events ?? []
  } catch {
    return []
  }
}

export default async function HomePage() {
  const events = await getEvents()

  return (
    <main className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-3xl font-bold mb-2">StagePass</h1>
      <p className="text-muted-foreground mb-8">Upcoming events</p>

      {events.length === 0 ? (
        <p className="text-muted-foreground italic">No upcoming events found.</p>
      ) : (
        <div className="grid gap-4">
          {events.map((event) => {
            const minPrice = Math.min(...event.price_tiers.map((t) => t.price))
            const showId = `${event.id}#${event.start_at.slice(0, 10)}#${event.start_at.slice(11, 16)}`
            return (
              <Link key={event.id} href={`/events/${encodeURIComponent(showId)}/seats`}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <CardTitle>{event.title}</CardTitle>
                      <Badge variant="secondary">From ₹{minPrice}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{event.venue.name} · {event.venue.city}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(event.start_at).toLocaleDateString('en-IN', {
                        weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </main>
  )
}
