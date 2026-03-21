import { NextResponse } from 'next/server'

const BOOKING_SERVICE_URL =
  process.env.BOOKING_SERVICE_URL ?? 'http://localhost:3001'

export async function POST(req: Request) {
  const accessToken = req.headers.get('x-access-token')
  const body = await req.json()

  const response = await fetch(`${BOOKING_SERVICE_URL}/api/bookings/hold`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  })

  const data = await response.json()
  return NextResponse.json(data, { status: response.status })
}

export async function DELETE(req: Request) {
  const accessToken = req.headers.get('x-access-token')
  const body = await req.json()

  const response = await fetch(`${BOOKING_SERVICE_URL}/api/bookings/hold`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  })

  const data = await response.json().catch(() => ({ ok: true }))
  return NextResponse.json(data, { status: response.status })
}
