import { Router } from 'express'
import type { EventController } from '../controllers/event.controller'

export function createEventRouter(controller: EventController): Router {
  const router = Router()
  router.get('/', controller.listEvents)
  router.get('/:id', controller.getEvent)
  return router
}
