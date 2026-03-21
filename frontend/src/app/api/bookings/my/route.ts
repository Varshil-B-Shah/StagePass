import { NextResponse } from 'next/server'

const BOOKING_SERVICE_URL =
  process.env.BOOKING_SERVICE_URL ?? 'http://localhost:3001'

export async function GET(req: Request) {
  const accessToken = req.headers.get('x-access-token')
  const response = await fetch(`${BOOKING_SERVICE_URL}/api/bookings/my`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const data = await response.json().catch(() => ({ bookings: [] }))
  return NextResponse.json(data, { status: response.status })
}
