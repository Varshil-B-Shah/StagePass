import { Request, Response, NextFunction } from 'express'
import { BookingService } from '../services/booking.service'

export class BookingController {
  constructor(private readonly bookingService: BookingService) {}

  private checkInternal(req: Request, res: Response): boolean {
    if (req.headers['x-internal-secret'] !== process.env.INTERNAL_API_SECRET) {
      res.status(403).json({ error: 'Forbidden' })
      return false
    }
    return true
  }

  confirm = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!this.checkInternal(req, res)) return
      const { booking_id, razorpay_order_id } = req.body
      if (!booking_id || !razorpay_order_id) {
        return res.status(400).json({ error: 'booking_id and razorpay_order_id required' })
      }
      await this.bookingService.confirm(booking_id, razorpay_order_id)
      return res.json({ ok: true })
    } catch (err) { next(err) }
  }

  expire = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!this.checkInternal(req, res)) return
      const { booking_id } = req.body
      if (!booking_id) return res.status(400).json({ error: 'booking_id required' })
      await this.bookingService.expire(booking_id)
      return res.json({ ok: true })
    } catch (err) { next(err) }
  }

  recordPayment = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!this.checkInternal(req, res)) return
      const { booking_id, razorpay_payment_id } = req.body
      if (!booking_id || !razorpay_payment_id) {
        return res.status(400).json({ error: 'booking_id and razorpay_payment_id required' })
      }
      await this.bookingService.recordPayment(booking_id, razorpay_payment_id)
      return res.json({ ok: true })
    } catch (err) { next(err) }
  }

  recordRefund = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!this.checkInternal(req, res)) return
      const { booking_id, refund_id, refund_status } = req.body
      if (!booking_id || !refund_id) {
        return res.status(400).json({ error: 'booking_id and refund_id required' })
      }
      await this.bookingService.recordRefund(booking_id, refund_id, refund_status ?? 'pending')
      return res.json({ ok: true })
    } catch (err) { next(err) }
  }

  recordRefundSettlement = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!this.checkInternal(req, res)) return
      const { refund_id, refund_status } = req.body
      if (!refund_id || !refund_status) {
        return res.status(400).json({ error: 'refund_id and refund_status required' })
      }
      const matched = await this.bookingService.recordRefundSettlement(refund_id, refund_status)
      // 200 even when nothing matched, so Razorpay stops retrying an unknown refund.
      return res.json({ ok: true, matched })
    } catch (err) { next(err) }
  }

  getById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!this.checkInternal(req, res)) return
      const booking = await this.bookingService.getById(req.params.id)
      if (!booking) return res.status(404).json({ error: 'Not found' })
      return res.json(booking)
    } catch (err) { next(err) }
  }

  release = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user_id = req.user?.sub
      if (!user_id) return res.status(401).json({ error: 'Unauthorized' })
      await this.bookingService.release(req.params.id, user_id)
      return res.json({ ok: true })
    } catch (err: unknown) {
      const e = err as { status?: number; message: string }
      if (e.status) return res.status(e.status).json({ error: e.message })
      next(err)
    }
  }

  myBookings = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user_id = req.user?.sub
      if (!user_id) return res.status(401).json({ error: 'Unauthorized' })
      const bookings = await this.bookingService.getMyBookings(user_id)
      return res.json({ bookings })
    } catch (err) { next(err) }
  }

  checkout = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user_id = req.headers['x-user-id'] as string
      const { show_id, seat_id, event_id } = req.body

      if (!show_id || !seat_id || !event_id) {
        return res.status(400).json({ error: 'show_id, seat_id, event_id required' })
      }
      if (!user_id) {
        return res.status(401).json({ error: 'Unauthorized' })
      }

      const result = await this.bookingService.checkout({ user_id, show_id, seat_id, event_id })
      return res.status(200).json(result)
    } catch (err: unknown) {
      const e = err as { status?: number; message: string }
      if (e.status) return res.status(e.status).json({ error: e.message })
      next(err)
    }
  }
}
