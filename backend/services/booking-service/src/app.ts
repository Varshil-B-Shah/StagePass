import express from 'express'
import { authMiddleware } from './middleware/auth.middleware'
import { errorMiddleware } from './middleware/error.middleware'
import { healthRouter } from './routes/health.routes'
import { createSeatRouter } from './routes/seat.routes'
import { createEventRouter } from './routes/event.routes'
import { SeatService } from './services/seat.service'
import { EventController } from './controllers/event.controller'
import { prisma } from './clients/prisma.client'

export function createApp(seatService: SeatService) {
  const app = express()
  app.use(express.json())
  app.use(healthRouter)
  app.use('/api/events', createEventRouter(new EventController(prisma)))
  app.use(authMiddleware)
  app.use('/api/bookings', createSeatRouter(seatService))
  app.use(errorMiddleware)
  return app
}
