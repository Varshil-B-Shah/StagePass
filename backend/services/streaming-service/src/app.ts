import express from 'express'
import { authMiddleware } from './middleware/auth.middleware'
import { healthRouter } from './routes/health.routes'
import { createStreamRouter } from './routes/stream.routes'
import { StreamController } from './controllers/stream.controller'
import { StreamService } from './services/stream.service'
import { StreamRepository } from './repositories/stream.repository'
import { BookingRepository } from './repositories/booking.repository'
import { getDynamoClient } from './clients/dynamo.client'
import { getPgPool } from './clients/pg.client'

export function createApp(): express.Express {
  const app = express()

  const streamRepo  = new StreamRepository(getDynamoClient())
  const bookingRepo = new BookingRepository(getPgPool())
  const service     = new StreamService(streamRepo, bookingRepo)
  const controller  = new StreamController(service)

  // Webhook: raw text body for LiveKit signature verification — BEFORE express.json()
  app.post('/api/streams/webhook', express.text({ type: '*/*' }), controller.handleWebhook)

  app.use(express.json())
  app.use(healthRouter)
  app.use(authMiddleware)

  app.use('/api/streams', createStreamRouter(controller))

  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('[streaming-service]', err.message)
    res.status(500).json({ error: 'Internal server error' })
  })

  return app
}
