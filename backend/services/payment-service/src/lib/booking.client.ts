import { config } from '../config'

export interface BookingRecord {
  id: string
  user_id: string
  show_id: string
  seats: string[]
  status: string
  payment_intent_id: string | null
  razorpay_payment_id: string | null
  refund_id: string | null
  refund_status: string | null
}

function internalHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'x-internal-secret': config.internal_api_secret,
  }
}

/** Reads a booking through booking-service — payment-service never touches Postgres. */
export async function getBooking(booking_id: string): Promise<BookingRecord | null> {
  const res = await fetch(`${config.booking_service_url}/api/bookings/${booking_id}`, {
    headers: internalHeaders(),
  })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`getBooking failed: ${res.status}`)
  return (await res.json()) as BookingRecord
}

/** Records the captured payment id against the booking, before confirmation is attempted. */
export async function recordPayment(booking_id: string, razorpay_payment_id: string): Promise<void> {
  const res = await fetch(`${config.booking_service_url}/api/bookings/payment`, {
    method: 'POST',
    headers: internalHeaders(),
    body: JSON.stringify({ booking_id, razorpay_payment_id }),
  })
  if (!res.ok) throw new Error(`recordPayment failed: ${res.status}`)
}

/** Marks the booking REFUNDED and stores the refund id returned by Razorpay. */
export async function recordRefund(
  booking_id: string,
  refund_id: string,
  refund_status: string
): Promise<void> {
  const res = await fetch(`${config.booking_service_url}/api/bookings/refund`, {
    method: 'POST',
    headers: internalHeaders(),
    body: JSON.stringify({ booking_id, refund_id, refund_status }),
  })
  if (!res.ok) throw new Error(`recordRefund failed: ${res.status}`)
}

/** Flips a pending refund to its settled state when the refund webhook arrives. */
export async function recordRefundSettlement(
  refund_id: string,
  refund_status: string
): Promise<void> {
  const res = await fetch(`${config.booking_service_url}/api/bookings/refund-settled`, {
    method: 'POST',
    headers: internalHeaders(),
    body: JSON.stringify({ refund_id, refund_status }),
  })
  if (!res.ok) throw new Error(`recordRefundSettlement failed: ${res.status}`)
}
