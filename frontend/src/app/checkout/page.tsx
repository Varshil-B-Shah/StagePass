'use client'
import { useSearchParams, useRouter } from 'next/navigation'
import { useState, useEffect, useRef, Suspense } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

declare global {
  interface Window {
    Razorpay: new (options: object) => { open: () => void }
  }
}

function CheckoutForm() {
  const params = useSearchParams()
  const router = useRouter()
  const show_id = params.get('show_id') || ''
  const seat_id = params.get('seat_id') || ''
  const event_id = params.get('event_id') || ''
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const paymentSucceeded = useRef(false)

  // Load Razorpay script
  useEffect(() => {
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    document.body.appendChild(script)
    return () => { document.body.removeChild(script) }
  }, [])

  async function handlePay() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/payments/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ show_id, seat_id, event_id }),
      })
      const data = await res.json() as {
        order_id: string; amount: number; currency: string; key_id: string; booking_id: string; error?: string
      }
      if (!res.ok) { setError(data.error || 'Failed'); setLoading(false); return }

      const bookingId = data.booking_id

      const rzp = new window.Razorpay({
        key: data.key_id,
        order_id: data.order_id,
        amount: data.amount,
        currency: data.currency,
        name: 'StagePass',
        description: `Seat ${seat_id}`,
        handler: () => {
          paymentSucceeded.current = true
          toast.success('Booking confirmed! Your ticket is reserved.', { duration: 5000 })
          router.push('/')
        },
        modal: {
          ondismiss: async () => {
            // Razorpay sometimes fires ondismiss in the same tick as handler.
            // Wait one microtask cycle so handler can set paymentSucceeded first.
            await new Promise(r => setTimeout(r, 300))
            if (paymentSucceeded.current) return
            try {
              await fetch(`/api/bookings/${bookingId}`, { method: 'DELETE' })
            } catch {
              // best effort
            }
            setLoading(false)
            router.push(
              `/events/${event_id}?show_id=${encodeURIComponent(show_id)}`
            )
          },
        },
      })
      rzp.open()
    } catch {
      setError('Something went wrong')
      setLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader><CardTitle>Checkout</CardTitle></CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-sm">Seat: <strong>{seat_id}</strong></p>
        <p className="text-sm">Show: <strong>{show_id}</strong></p>
        <p className="text-lg font-bold">₹500</p>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button onClick={handlePay} disabled={loading}>
          {loading ? 'Processing...' : 'Pay ₹500'}
        </Button>
      </CardContent>
    </Card>
  )
}

export default function CheckoutPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Suspense><CheckoutForm /></Suspense>
    </main>
  )
}
