import { Router } from 'express'
import { SeatService } from '../services/seat.service'
import { SeatController } from '../controllers/seat.controller'

export function createSeatRouter(seatService: SeatService): Router {
  const router = Router()
  const ctrl = new SeatController(seatService)
  router.post('/hold', ctrl.hold)
  router.delete('/hold', ctrl.expireHold)
  router.get('/seat-map/:show_id', ctrl.getSeatMap)
  router.get('/user-holds/:show_id', ctrl.getUserHolds)
  return router
}
