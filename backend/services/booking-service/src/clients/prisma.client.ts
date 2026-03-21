import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

// Prisma v7: PrismaClient requires a driver adapter.
// DATABASE_URL uses the pgBouncer pooler (port 6543) for runtime queries.
function createPrismaClient(): PrismaClient {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL! })
  const adapter = new PrismaPg(pool)
  return new PrismaClient({ adapter })
}

let client: PrismaClient | null = null

export function getPrismaClient(): PrismaClient {
  if (!client) {
    client = createPrismaClient()
  }
  return client
}

// Named export for direct use (used in EventController and tests)
export const prisma = createPrismaClient()
