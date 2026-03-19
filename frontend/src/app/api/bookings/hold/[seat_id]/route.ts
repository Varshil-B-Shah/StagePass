import { NextResponse } from 'next/server'

const BOOKING_SERVICE_URL =
  process.env.BOOKING_SERVICE_URL ?? 'http://localhost:3001'

export async function DELETE(
  req: Request,
  { params }: { params: { seat_id: string } }
) {
  const accessToken = req.headers.get('x-access-token')
  const body = await req.json()

  const response = await fetch(
    `${BOOKING_SERVICE_URL}/api/bookings/hold/${params.seat_id}`,
    {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
    }
  )

  const data = await response.json()
  return NextResponse.json(data, { status: response.status })
}
