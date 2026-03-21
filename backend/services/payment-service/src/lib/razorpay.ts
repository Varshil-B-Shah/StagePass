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
