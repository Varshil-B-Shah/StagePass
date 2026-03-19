import { NextResponse } from 'next/server'

const BOOKING_SERVICE_URL =
  process.env.BOOKING_SERVICE_URL ?? 'http://localhost:3001'

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const response = await fetch(
    `${BOOKING_SERVICE_URL}/api/events/${params.id}/seats`
  )
  const data = await response.json()
  return NextResponse.json(data, { status: response.status })
}
