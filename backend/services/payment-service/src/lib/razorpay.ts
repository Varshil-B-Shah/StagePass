import Razorpay from 'razorpay'
import { createHmac } from 'crypto'
import { config } from '../config'

export const razorpay = new Razorpay({
  key_id: config.razorpay.key_id,
  key_secret: config.razorpay.key_secret,
})

export interface RazorpayOrder {
  id: string
  amount: number
  currency: string
}

export async function createRazorpayOrder(amountPaise: number): Promise<RazorpayOrder> {
  const order = await razorpay.orders.create({
    amount: amountPaise,
    currency: 'INR',
    payment_capture: true,
  })
  return { id: order.id, amount: order.amount as number, currency: order.currency }
}

export function verifyWebhookSignature(body: string, signature: string): boolean {
  if (!config.razorpay.webhook_secret || config.razorpay.webhook_secret === 'placeholder') {
    console.warn('[razorpay] webhook signature verification skipped (no secret configured)')
    return true
  }
  const expected = createHmac('sha256', config.razorpay.webhook_secret)
    .update(body)
    .digest('hex')
  return expected === signature
}

export interface RazorpayRefund {
  id: string
  status: string
  amount: number
}

/**
 * Issues a refund against a captured payment.
 * Refunds are raised on the payment (pay_...), never on the order (order_...).
 * Omitting amountPaise refunds the full captured amount.
 *
 * Razorpay settles refunds asynchronously: this returns status 'pending',
 * and the money reaches the customer hours later. The `refund.processed`
 * webhook is what confirms settlement.
 */
export async function refundPayment(
  payment_id: string,
  amountPaise?: number
): Promise<RazorpayRefund> {
  const params: Record<string, unknown> = { speed: 'normal' }
  if (amountPaise !== undefined) params.amount = amountPaise

  // The SDK's refund typings are loose across 2.x — cast the result shape we rely on.
  const refund = (await razorpay.payments.refund(
    payment_id,
    params as never
  )) as unknown as { id: string; status: string; amount: number }

  return { id: refund.id, status: refund.status, amount: refund.amount }
}
