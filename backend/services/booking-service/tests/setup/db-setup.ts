import { DynamoDB } from 'aws-sdk'
import { createClient } from 'redis'
import { PrismaClient } from '@prisma/client'

const dynamo = new DynamoDB.DocumentClient({
  endpoint: process.env.DYNAMODB_ENDPOINT || 'http://localhost:8000',
  region: 'us-east-1',
  accessKeyId: 'local',
  secretAccessKey: 'local',
})

// ── DynamoDB helpers ────────────────────────────────────────────────

export const TEST_SHOW_ID = 'EVT-001#2025-04-01#19:00'
export const TEST_SEAT_ID = 'A1'
export const TEST_USER_ID = 'user-seed-test'  // matches seed.ts

/** Reset a single seat to AVAILABLE state */
export async function resetSeat(
  show_id = TEST_SHOW_ID,
  seat_id = TEST_SEAT_ID
): Promise<void> {
  await dynamo.update({
    TableName: 'seats',
    Key: { PK: show_id, SK: seat_id },
    UpdateExpression:
      'SET #status = :a REMOVE held_by, hold_expires_at, hold_expires_at_ttl, booked_by',
    ExpressionAttributeNames: { '#status': 'status' },
    ExpressionAttributeValues: { ':a': 'AVAILABLE' },
  }).promise()
}

// ── Redis helpers ────────────────────────────────────────────────────

let redisClient: ReturnType<typeof createClient> | null = null

export async function getTestRedisClient() {
  if (!redisClient) {
    redisClient = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' })
    await redisClient.connect()
  }
  return redisClient
}

/** Delete all hold|* and user_holds|* keys for a show/seat pair */
export async function clearHoldKeys(
  show_id = TEST_SHOW_ID,
  seat_id = TEST_SEAT_ID,
  user_id = TEST_USER_ID
): Promise<void> {
  const client = await getTestRedisClient()
  await client.del(`hold|${show_id}|${seat_id}`)
  await client.del(`user_holds|${user_id}|${show_id}`)
}

// ── PostgreSQL helpers ───────────────────────────────────────────────

let prisma: PrismaClient | null = null

export function getTestPrismaClient(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient()
  }
  return prisma
}

/** Delete all Booking records for the test user */
export async function clearTestBookings(user_id = TEST_USER_ID): Promise<void> {
  const db = getTestPrismaClient()
  await db.booking.deleteMany({ where: { user_id } })
}
