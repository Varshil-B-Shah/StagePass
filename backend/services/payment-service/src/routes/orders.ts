import { Router, Request, Response } from 'express'
import { createRazorpayOrder } from '../lib/razorpay'
import { startPaymentExecution } from '../lib/stepfunctions'
import { savePaymentTask } from '../lib/dynamo'
import { config } from '../config'

export const ordersRouter = Router()

ordersRouter.post('/create-order', async (req: Request, res: Response) => {
  const user_id = req.headers['x-user-id'] as string
  const access_token = req.headers['x-access-token'] as string
  const { show_id, seat_id, event_id } = req.body

  if (!show_id || !seat_id || !event_id) {
    return res.status(400).json({ error: 'show_id, seat_id, event_id required' })
  }

  try {
    // Call booking-service checkout to reserve the seat
    const checkoutRes = await fetch(`${config.booking_service_url}/api/bookings/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${access_token}`,
        'x-internal-secret': config.internal_api_secret,
        'x-user-id': user_id,
      },
      body: JSON.stringify({ show_id, seat_id, event_id }),
    })

    if (!checkoutRes.ok) {
      const err = await checkoutRes.json() as { error: string }
      return res.status(checkoutRes.status).json(err)
    }

    const { booking_id } = await checkoutRes.json() as { booking_id: string }

    // Create Razorpay order (₹500 — price tier support added in Phase 3)
    const order = await createRazorpayOrder(50000)

    // Save task record NOW so the webhook always finds booking_id regardless of
    // Step Functions Lambda timing. task_token is empty string — the webhook only
    // calls sendTaskSuccess when a real token is present (set by the Lambda later).
    await savePaymentTask({
      razorpay_order_id: order.id,
      booking_id,
      show_id,
      task_token: '',
      expires_at: Math.floor(Date.now() / 1000) + 3600,
    })

    // Start Step Functions — Lambda will overwrite task_token in the same record
    startPaymentExecution({ booking_id, show_id, razorpay_order_id: order.id }).catch(
      (err) => console.error('[payment] Step Functions start failed (non-fatal):', err.message)
    )

    return res.json({
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      key_id: config.razorpay.key_id,
      booking_id,
    })
  } catch (err) {
    console.error('[payment] create-order error:', err)
    return res.status(500).json({ error: 'Failed to create order' })
  }
})
