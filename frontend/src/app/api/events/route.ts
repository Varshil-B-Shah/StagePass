import { NextResponse } from 'next/server'

const BOOKING_SERVICE_URL =
  process.env.BOOKING_SERVICE_URL ?? 'http://localhost:3001'

export async function GET() {
  const response = await fetch(`${BOOKING_SERVICE_URL}/api/events`)
  const data = await response.json()
  return NextResponse.json(data, { status: response.status })
}
