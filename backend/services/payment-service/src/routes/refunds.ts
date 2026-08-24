import { Router, Request, Response } from 'express'
import { refundPayment } from '../lib/razorpay'
import { getBooking, recordRefund } from '../lib/booking.client'
import { config } from '../config'

export const refundsRouter = Router()

export type RefundOutcome =
  | { refunded: false; reason: 'no_payment' | 'booking_confirmed' | 'booking_not_found' }
  | { refunded: false; reason: 'already_refunded'; refund_id: string }
  | { refunded: true; refund_id: string; refund_status: string; amount: number }

/**
 * Compensation endpoint — called by the RefundPayment Lambda, never by a browser.
 *
 * A refund is owed in exactly one situation: the money was captured and the seat
 * could not be delivered. Every other case is a no-op, which is why the common
 * path (a payment that was never captured) returns 200 with refunded: false.
 */
refundsRouter.post('/internal/refund', async (req: Request, res: Response) => {
  if (req.headers['x-internal-secret'] !== config.internal_api_secret) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  const { booking_id, amount } = req.body as { booking_id?: string; amount?: number }
  if (!booking_id) {
    return res.status(400).json({ error: 'booking_id required' })
  }

  try {
    const booking = await getBooking(booking_id)

    // ── Idempotency and eligibility guards ──────────────────────────────────
    if (!booking) {
      return res.json({ refunded: false, reason: 'booking_not_found' } satisfies RefundOutcome)
    }
    if (booking.refund_id) {
      // A replayed compensation must never refund twice.
      return res.json({
        refunded: false,
        reason: 'already_refunded',
        refund_id: booking.refund_id,
      } satisfies RefundOutcome)
    }
    if (!booking.razorpay_payment_id) {
      // Nothing was ever captured — the ordinary timeout path lands here.
      return res.json({ refunded: false, reason: 'no_payment' } satisfies RefundOutcome)
    }
    if (booking.status === 'CONFIRMED') {
      // Payment landed and the seat was delivered; the customer keeps both.
      return res.json({ refunded: false, reason: 'booking_confirmed' } satisfies RefundOutcome)
    }

    const refund = await refundPayment(booking.razorpay_payment_id, amount)
    await recordRefund(booking_id, refund.id, refund.status)

    console.log('[refund] issued', {
      booking_id,
      payment_id: booking.razorpay_payment_id,
      refund_id: refund.id,
      status: refund.status,
    })

    return res.json({
      refunded: true,
      refund_id: refund.id,
      refund_status: refund.status,
      amount: refund.amount,
    } satisfies RefundOutcome)
  } catch (err) {
    const message = (err as Error).message
    console.error('[refund] failed', { booking_id, message })
    return res.status(500).json({ error: 'Refund failed', message })
  }
})
