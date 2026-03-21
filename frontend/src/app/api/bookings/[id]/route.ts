import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

const BOOKING_SERVICE_URL =
  process.env.BOOKING_SERVICE_URL ?? 'http://localhost:3001'

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const cookieStore = cookies()
  const accessToken = cookieStore.get('access_token')?.value

  if (!accessToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const response = await fetch(
    `${BOOKING_SERVICE_URL}/api/bookings/${params.id}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  )

  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    return NextResponse.json(data, { status: response.status })
  }

  return NextResponse.json({ ok: true })
}
