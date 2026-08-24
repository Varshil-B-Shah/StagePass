import express from 'express'
import { ordersRouter } from './routes/orders'
import { webhookRouter } from './routes/webhook'
import { refundsRouter } from './routes/refunds'

export function createApp() {
  const app = express()

  // Raw body for webhook HMAC verification — must come before JSON parser
  app.use('/api/payments/webhook', express.raw({ type: 'application/json' }))

  // JSON for everything else
  app.use((req, res, next) => {
    if (req.path === '/api/payments/webhook') return next()
    express.json()(req, res, next)
  })

  // Lightweight auth check — real JWT validation is in Next.js middleware.
  // /internal/* is machine-to-machine and guards itself with x-internal-secret.
  const PUBLIC = ['/api/payments/webhook', '/api/payments/internal', '/health']
  app.use((req, res, next) => {
    if (PUBLIC.some(p => req.path.startsWith(p))) return next()
    if (!req.headers['x-user-id']) return res.status(401).json({ error: 'Unauthorized' })
    next()
  })

  app.use('/api/payments', ordersRouter)
  app.use('/api/payments', webhookRouter)
  app.use('/api/payments', refundsRouter)
  app.get('/health', (_, res) => res.json({ ok: true }))

  return app
}
