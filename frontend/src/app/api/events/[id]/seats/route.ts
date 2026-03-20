import { NextResponse } from 'next/server'

const BOOKING_SERVICE_URL =
  process.env.BOOKING_SERVICE_URL ?? 'http://localhost:3001'

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const accessToken = req.headers.get('x-access-token')
  try {
    const response = await fetch(
      `${BOOKING_SERVICE_URL}/api/bookings/seat-map/${encodeURIComponent(params.id)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )
    const data = await response.json()
    if (!response.ok) {
      console.error(`[seats BFF] upstream ${response.status} for show_id=${params.id}:`, data)
    }
    return NextResponse.json(data, { status: response.status })
  } catch (err) {
    console.error('[seats BFF] fetch error:', err)
    return NextResponse.json({ error: 'Failed to fetch seat map' }, { status: 502 })
  }
}
