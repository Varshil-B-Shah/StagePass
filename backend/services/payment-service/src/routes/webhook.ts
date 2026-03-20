import { Router, Request, Response } from 'express'
import { verifyWebhookSignature } from '../lib/razorpay'
import { getPaymentTask, deletePaymentTask } from '../lib/dynamo'
import { sendTaskSuccess } from '../lib/stepfunctions'
import { config } from '../config'

export const webhookRouter = Router()

webhookRouter.post('/webhook', async (req: Request, res: Response) => {
  const signature = req.headers['x-razorpay-signature'] as string
  const rawBody = req.body as Buffer  // express.raw() applied in app.ts for this path

  if (!signature || !rawBody?.length) {
    return res.status(400).json({ error: 'Missing signature or body' })
  }

  if (!verifyWebhookSignature(rawBody.toString(), signature)) {
    return res.status(400).json({ error: 'Invalid signature' })
  }

  const payload = JSON.parse(rawBody.toString()) as {
    event: string
    payload?: { payment?: { entity?: { order_id?: string } } }
  }

  if (payload.event !== 'payment.captured') {
    return res.status(200).json({ ok: true })
  }

  const razorpay_order_id = payload.payload?.payment?.entity?.order_id
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
    console.error('[webhook] booking confirm failed:', await confirmRes.json())
    return res.status(500).json({ error: 'Booking confirmation failed' })
  }

  // Delete task record (idempotency — duplicate webhooks find no task)
  await deletePaymentTask(razorpay_order_id).catch(e =>
    console.error('[webhook] delete task failed:', e)
  )

  // Resume Step Functions
  await sendTaskSuccess(task.task_token, {
    booking_id: task.booking_id,
    show_id: task.show_id,
    razorpay_order_id,
  })

  return res.status(200).json({ ok: true })
})
