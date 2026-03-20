import { Router } from 'express'
import { getDynamoClient } from '../clients/dynamo.client'
import { getPrismaClient } from '../clients/prisma.client'
import { getRedisClient } from '../clients/redis.client'

export const healthRouter = Router()

healthRouter.get('/healthz', (_req, res) => {
  res.json({ status: 'ok' })
})

healthRouter.get('/ready', async (_req, res) => {
  const checks = await Promise.allSettled([
    getDynamoClient()
      .scan({ TableName: 'seats', Limit: 1 })
      .promise(),
    getPrismaClient().$queryRaw`SELECT 1`,
    getRedisClient().then((c) => c.ping()),
  ])

  const failed = checks.filter((c) => c.status === 'rejected')

  if (failed.length > 0) {
    res.status(503).json({
      status: 'unavailable',
      failures: failed.map((c) => (c as PromiseRejectedResult).reason?.message),
    })
    return
  }

  res.json({ status: 'ready' })
})
