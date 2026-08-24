/**
 * RefundPayment — compensation step.
 *
 * Runs when the payment workflow fails or times out. A refund is owed in exactly
 * one situation: the money was captured and the seat could not be delivered.
 * Every other case is a no-op, so this returns successfully rather than throwing
 * when there is nothing to refund — the ordinary timeout (nobody paid) lands here.
 *
 * The refund decision and the Razorpay call live in payment-service; this Lambda
 * only triggers them, the same way expire-hold delegates to booking-service.
 */
exports.handler = async (event) => {
  const booking_id = event.booking_id || event.input?.booking_id

  if (!booking_id) {
    console.error('Missing booking_id:', JSON.stringify(event))
    return { refunded: false, reason: 'no_booking_id' }
  }

  const res = await fetch(`${process.env.PAYMENT_SERVICE_URL}/api/payments/internal/refund`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-internal-secret': process.env.INTERNAL_API_SECRET,
    },
    body: JSON.stringify({ booking_id }),
  })

  const body = await res.json().catch(() => ({}))

  if (!res.ok) {
    // Throw so the failure is visible in the execution history. The state machine
    // catches it and still runs ExpireHold, so the seat is released either way.
    throw new Error(`Refund failed (${res.status}): ${JSON.stringify(body)}`)
  }

  console.log('[refund-payment]', booking_id, JSON.stringify(body))
  return body
}
