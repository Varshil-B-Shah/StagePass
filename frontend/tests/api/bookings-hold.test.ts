import fetchMock from 'jest-fetch-mock'
import { POST } from '../../src/app/api/bookings/hold/route'

process.env.BOOKING_SERVICE_URL = 'http://booking-service:3001'

function makeHoldRequest(body: object, accessToken = 'test-token') {
  return new Request('http://localhost/api/bookings/hold', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': 'user-1',
      'x-access-token': accessToken,
    },
    body: JSON.stringify(body),
  })
}

describe('POST /api/bookings/hold', () => {
  beforeEach(() => fetchMock.resetMocks())

  it('forwards request to booking-service with Authorization header', async () => {
    fetchMock.mockResponseOnce(
      JSON.stringify({ success: true, expires_at: 9_999_999 }),
      { status: 200 }
    )

    const req = makeHoldRequest({ show_id: 'EVT-001#2025-04-01#19:00', seat_id: 'A1' })
    const res = await POST(req)

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.success).toBe(true)

    const [calledUrl, calledInit] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(calledUrl).toContain('/api/bookings/hold')
    expect((calledInit.headers as Record<string, string>)['Authorization']).toBe(
      'Bearer test-token'
    )
  })

  it('passes through 409 from booking-service unchanged', async () => {
    fetchMock.mockResponseOnce(
      JSON.stringify({ error: 'Seat taken' }),
      { status: 409 }
    )

    const req = makeHoldRequest({ show_id: 'EVT-001#2025-04-01#19:00', seat_id: 'A1' })
    const res = await POST(req)

    expect(res.status).toBe(409)
    const data = await res.json()
    expect(data.error).toBe('Seat taken')
  })
})
