'use client'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Ticket, CalendarDays } from 'lucide-react'

interface Booking {
  id: string
  show_id: string
  seats: string[]
  status: string
  created_at: string
}

export function MyBookings() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    fetch('/api/bookings/my')
      .then((r) => r.json())
      .then((data: { bookings?: Booking[] }) => {
        setBookings(data.bookings ?? [])
        setLoaded(true)
      })
      .catch(() => setLoaded(true))
  }, [])

  if (!loaded || bookings.length === 0) return null

  return (
    <section className="mx-auto max-w-5xl px-4 pb-12">
      <h2 className="text-2xl font-bold mb-6">My Bookings</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {bookings.map((booking) => {
          const [eventId, date, time] = booking.show_id.split('#')
          return (
            <Card key={booking.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base font-semibold">{eventId}</CardTitle>
                  <Badge variant="secondary" className="text-green-600 shrink-0">Confirmed</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                  {date} at {time}
                </div>
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Ticket className="h-3.5 w-3.5 shrink-0" />
                  Seats: {booking.seats.join(', ')}
                </div>
                <p className="text-xs text-muted-foreground font-mono break-all pt-1">{booking.id}</p>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </section>
  )
}
