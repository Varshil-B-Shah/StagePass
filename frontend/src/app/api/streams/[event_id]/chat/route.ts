import { NextResponse } from 'next/server'

const STREAMING_SERVICE_URL = process.env.STREAMING_SERVICE_URL ?? 'http://localhost:3003'

export async function GET(
  _req: Request,
  { params }: { params: { event_id: string } }
) {
  const res = await fetch(
    `${STREAMING_SERVICE_URL}/api/streams/${params.event_id}/chat`
  ).catch(() => null)

  if (!res) return NextResponse.json({ messages: [] }, { status: 200 })
  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}
