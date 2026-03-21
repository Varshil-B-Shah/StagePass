import express from 'express'
import { authMiddleware } from './middleware/auth.middleware'
import { errorMiddleware } from './middleware/error.middleware'
import { healthRouter } from './routes/health.routes'
import { createSeatRouter } from './routes/seat.routes'
import { createEventRouter } from './routes/event.routes'
import { createBookingRouter } from './routes/booking.routes'
import { SeatService } from './services/seat.service'
import { BookingService } from './services/booking.service'
import { BookingController } from './controllers/booking.controller'
import { IWsService } from './services/ws.service'
import { BookingRepository } from './repositories/booking.repository'
import { RedisRepository } from './repositories/redis.repository'
import { SeatRepository } from './repositories/seat.repository'
import { EventController } from './controllers/event.controller'
import { getDynamoClient } from './clients/dynamo.client'
import { getRedisClient } from './clients/redis.client'
import { prisma } from './clients/prisma.client'

export async function createApp(seatService: SeatService, wsService: IWsService) {
  const app = express()
  app.use(express.json())
  app.use(healthRouter)
  app.use('/api/events', createEventRouter(new EventController(prisma)))

  const redisClient = await getRedisClient()
  const redisRepo = new RedisRepository(redisClient)
  const seatRepo = new SeatRepository(getDynamoClient())
  const bookingRepo = new BookingRepository(prisma)
  const bookingService = new BookingService(seatRepo, bookingRepo, redisRepo, wsService)
  const bookingController = new BookingController(bookingService)

  app.use(authMiddleware)
  app.use('/api/bookings', createSeatRouter(seatService))
  app.use('/api/bookings', createBookingRouter(bookingController))
  app.use(errorMiddleware)
  return app
}
