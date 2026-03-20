import { NextRequest, NextResponse } from 'next/server'

const PAYMENT_SERVICE_URL = process.env.PAYMENT_SERVICE_URL || 'http://localhost:3002'

export async function POST(req: NextRequest) {
  const accessToken = req.headers.get('x-access-token') || ''
  const userId = req.headers.get('x-user-id') || ''
  const body = await req.json()

  const res = await fetch(`${PAYMENT_SERVICE_URL}/api/payments/create-order`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': userId,
      'x-access-token': accessToken,
    },
    body: JSON.stringify(body),
  })

  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}
