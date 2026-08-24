import { Router, Request, Response } from 'express'
import { verifyWebhookSignature } from '../lib/razorpay'
import { getPaymentTask, deletePaymentTask } from '../lib/dynamo'
import { sendTaskSuccess } from '../lib/stepfunctions'
import { recordPayment, recordRefundSettlement } from '../lib/booking.client'
import { config } from '../config'

export const webhookRouter = Router()

interface RazorpayWebhookBody {
  event: string
  payload?: {
    payment?: { entity?: { id?: string; order_id?: string } }
    refund?: { entity?: { id?: string; status?: string; payment_id?: string } }
  }
}

webhookRouter.post('/webhook', async (req: Request, res: Response) => {
  const signature = req.headers['x-razorpay-signature'] as string
  const rawBody = req.body as Buffer  // express.raw() applied in app.ts for this path

  if (!signature || !rawBody?.length) {
    return res.status(400).json({ error: 'Missing signature or body' })
  }

  if (!verifyWebhookSignature(rawBody.toString(), signature)) {
    return res.status(400).json({ error: 'Invalid signature' })
  }

  const payload = JSON.parse(rawBody.toString()) as RazorpayWebhookBody

  if (payload.event === 'payment.captured') {
    return handlePaymentCaptured(payload, res)
  }

  // Refunds settle asynchronously — these close the loop hours after we raise one.
  if (payload.event === 'refund.processed' || payload.event === 'refund.failed') {
    return handleRefundSettled(payload, res)
  }

  return res.status(200).json({ ok: true })
})

async function handlePaymentCaptured(payload: RazorpayWebhookBody, res: Response) {
  const entity = payload.payload?.payment?.entity
  const razorpay_order_id = entity?.order_id
  const razorpay_payment_id = entity?.id

  if (!razorpay_order_id) {
    return res.status(200).json({ ok: true })
  }

  // Retry up to 3× if task not in DynamoDB yet (webhook race condition)
  let task = null
  for (let i = 0; i < 3; i++) {
    task = await getPaymentTask(razorpay_order_id)
    if (task) break
    await new Promise(r => setTimeout(r, 500))
  }

  if (!task) {
    console.error('[webhook] task not found after retries:', razorpay_order_id)
    return res.status(200).json({ ok: true })  // Razorpay won't retry on 200
  }

  // Record the payment id BEFORE attempting delivery. If confirmation then fails,
  // the compensation path still knows which payment to refund. Failing here is
  // worth a retry: without the payment id a captured payment is unrefundable.
  if (razorpay_payment_id) {
    try {
      await recordPayment(task.booking_id, razorpay_payment_id)
    } catch (err) {
      console.error('[webhook] recordPayment failed:', (err as Error).message)
      return res.status(500).json({ error: 'Could not record payment' })
    }
  }

  // Confirm booking in booking-service before calling SendTaskSuccess
  const confirmRes = await fetch(`${config.booking_service_url}/api/bookings/confirm`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-internal-secret': config.internal_api_secret,
    },
    body: JSON.stringify({ booking_id: task.booking_id, razorpay_order_id }),
  })

  if (!confirmRes.ok) {
    // Leave the task in place and fail loudly. Razorpay retries; if it never
    // succeeds the state machine times out and the RefundPayment state returns
    // the money, because the payment id was recorded above.
    console.error('[webhook] booking confirm failed:', await confirmRes.json())
    return res.status(500).json({ error: 'Booking confirmation failed' })
  }

  // Delete task record (idempotency — duplicate webhooks find no task)
  await deletePaymentTask(razorpay_order_id).catch(e =>
    console.error('[webhook] delete task failed:', e)
  )

  // Resume Step Functions only when a real task token exists.
  // task_token is '' when Step Functions hasn't stored its token yet
  // (e.g. local dev without a running state machine).
  if (task.task_token) {
    await sendTaskSuccess(task.task_token, {
      booking_id: task.booking_id,
      show_id: task.show_id,
      razorpay_order_id,
    })
  }

  return res.status(200).json({ ok: true })
}

async function handleRefundSettled(payload: RazorpayWebhookBody, res: Response) {
  const refund = payload.payload?.refund?.entity
  if (!refund?.id) {
    return res.status(200).json({ ok: true })
  }

  try {
    await recordRefundSettlement(refund.id, refund.status ?? 'processed')
    console.log('[webhook] refund settled', { refund_id: refund.id, status: refund.status })
  } catch (err) {
    console.error('[webhook] refund settlement failed:', (err as Error).message)
    return res.status(500).json({ error: 'Could not record refund settlement' })
  }

  return res.status(200).json({ ok: true })
}
