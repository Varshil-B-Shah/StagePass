import Link from 'next/link'
import type { Event } from '@/types/event.types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CalendarDays, MapPin, Ticket, ArrowRight } from 'lucide-react'
import { MyBookings } from '@/components/MyBookings'

export const revalidate = 60

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
    <>
      {/* Hero */}
      <section className="border-b bg-gradient-to-br from-primary/5 via-background to-background">
        <div className="mx-auto max-w-5xl px-4 py-20 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-sm text-primary font-medium">
            <Ticket className="h-3.5 w-3.5" />
            Real-time seat booking
          </div>
          <h1 className="text-5xl font-bold tracking-tight mb-4">
            Your next experience<br />
            <span className="text-primary">starts here</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto mb-8">
            Browse events, pick your seat live, and get your tickets in seconds.
          </p>
          <Button size="lg" asChild>
            <a href="#events">
              Browse Events <ArrowRight className="ml-2 h-4 w-4" />
            </a>
          </Button>
        </div>
      </section>

      {/* Events */}
      <main id="events" className="mx-auto max-w-5xl px-4 py-12">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">Upcoming Events</h2>
          <span className="text-sm text-muted-foreground">{events.length} event{events.length !== 1 ? 's' : ''}</span>
        </div>

        {events.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-muted/30 py-20 text-center">
            <Ticket className="mx-auto h-10 w-10 text-muted-foreground/50 mb-4" />
            <p className="font-medium text-muted-foreground">No upcoming events found.</p>
            <p className="text-sm text-muted-foreground mt-1">Check back soon — events are being added.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {events.map((event) => {
              const minPrice = Math.min(...event.price_tiers.map((t) => t.price))
              const showId = `${event.id}#${event.start_at.slice(0, 10)}#${event.start_at.slice(11, 16)}`
              return (
                <Link key={event.id} href={`/events/${encodeURIComponent(showId)}/seats`}>
                  <Card className="group h-full cursor-pointer transition-all hover:shadow-md hover:border-primary/30">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-base font-semibold group-hover:text-primary transition-colors">
                          {event.title}
                        </CardTitle>
                        <Badge variant="secondary" className="shrink-0 text-primary font-semibold">
                          From ₹{minPrice}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5 shrink-0" />
                        {event.venue.name} · {event.venue.city}
                      </div>
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                        {new Date(event.start_at).toLocaleDateString('en-IN', {
                          weekday: 'short',
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              )
            })}
          </div>
        )}
      </main>

      <MyBookings />
    </>
  )
}
