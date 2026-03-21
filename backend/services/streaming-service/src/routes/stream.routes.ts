import { Router } from 'express'
import { StreamController } from '../controllers/stream.controller'

export function createStreamRouter(controller: StreamController): Router {
  const router = Router()
  router.get('/:event_id',       controller.getStatus)
  router.get('/:event_id/token', controller.getToken)
  router.get('/:event_id/chat',  controller.getChatHistory)
  return router
}
