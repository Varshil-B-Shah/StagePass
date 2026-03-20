import { Router, Request, Response } from 'express'
import { createRazorpayOrder } from '../lib/razorpay'
import { startPaymentExecution } from '../lib/stepfunctions'
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

    // Start Step Functions — Lambda will save the task_token to DynamoDB
    await startPaymentExecution({ booking_id, show_id, razorpay_order_id: order.id })

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
