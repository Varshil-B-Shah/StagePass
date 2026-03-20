import { PrismaClient } from '@prisma/client'

let client: PrismaClient | null = null

export function getPrismaClient(): PrismaClient {
  if (!client) {
    client = new PrismaClient()
  }
  return client
}

// Named export for direct use (used in Chunk 8 EventController and tests)
export const prisma = new PrismaClient()
