import 'dotenv/config'
import { config, validateConfig } from './config'
import { createApp } from './app'
import { getRedisClient } from './clients/redis.client'
import { getPrismaClient } from './clients/prisma.client'
import { getDynamoClient } from './clients/dynamo.client'
import { SeatRepository } from './repositories/seat.repository'
import { RedisRepository } from './repositories/redis.repository'
import { BookingRepository } from './repositories/booking.repository'
import { SeatService } from './services/seat.service'
import { createWsService } from './services/ws.service'
import { RedisSubscriber } from './subscribers/redis.subscriber'

async function start() {
  validateConfig()

  const dynamo = getDynamoClient()
  const prisma = getPrismaClient()
  const redis = await getRedisClient()

  await prisma.$queryRaw`SELECT 1`

  const seatRepo = new SeatRepository(dynamo)
  const redisRepo = new RedisRepository(redis)
  const bookingRepo = new BookingRepository(prisma)
  const wsService = createWsService()
  const seatService = new SeatService(seatRepo, redisRepo, bookingRepo, wsService)

  const subscriber = new RedisSubscriber(seatService)
  await subscriber.start()

  const app = createApp(seatService)
  app.listen(config.port, () => {
    console.log(`[booking-service] listening on :${config.port}`)
  })

  process.on('SIGTERM', async () => {
    await subscriber.stop()
    process.exit(0)
  })
}

start().catch((err) => {
  console.error('[booking-service] startup failed:', err)
  process.exit(1)
})
