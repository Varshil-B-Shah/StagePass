import { NextResponse } from 'next/server'

const STREAMING_SERVICE_URL = process.env.STREAMING_SERVICE_URL ?? 'http://localhost:3003'

export async function GET(
  req: Request,
  { params }: { params: { event_id: string } }
) {
  const accessToken = req.headers.get('x-access-token')
  const res = await fetch(
    `${STREAMING_SERVICE_URL}/api/streams/${params.event_id}/token`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  ).catch(() => null)

  if (!res) return NextResponse.json({ error: 'Streaming service unavailable' }, { status: 503 })
  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}
