import { Router } from 'express'
import { BookingController } from '../controllers/booking.controller'

export function createBookingRouter(controller: BookingController): Router {
  const router = Router()
  router.post('/checkout', controller.checkout)
  router.post('/confirm', controller.confirm)
  router.post('/expire', controller.expire)
  router.get('/my', controller.myBookings)
  router.get('/:id', controller.getById)
  router.delete('/:id', controller.release)
  return router
}
