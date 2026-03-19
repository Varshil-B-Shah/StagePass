import { PrismaClient } from '@prisma/client'
import { DynamoDB } from 'aws-sdk'

const prisma = new PrismaClient()

const dynamo = new DynamoDB.DocumentClient({
  endpoint: process.env.DYNAMODB_ENDPOINT || 'http://localhost:8000',
  region: process.env.AWS_REGION || 'us-east-1',
  accessKeyId: 'local',
  secretAccessKey: 'local',
})

// Deterministic IDs so the seed is idempotent
const VENUE_ID = 'venue-the-stage'
const EVENT_ID = 'EVT-001'
const USER_ID = 'user-seed-test'
const SHOW_ID = `${EVENT_ID}#2025-04-01#19:00`

const ROWS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J']
const SEATS_PER_ROW = 10

// Price tier assignment by row
function tierForRow(row: string): { tierId: string; name: string; price: number } {
  if (['A', 'B', 'C', 'D'].includes(row)) {
    return { tierId: `${EVENT_ID}-general`, name: 'GENERAL', price: 50 }
  }
  if (['E', 'F', 'G'].includes(row)) {
    return { tierId: `${EVENT_ID}-premium`, name: 'PREMIUM', price: 100 }
  }
  return { tierId: `${EVENT_ID}-vip`, name: 'VIP', price: 200 }
}

async function seedPostgres() {
  // Venue
  await prisma.venue.upsert({
    where: { id: VENUE_ID },
    update: {},
    create: {
      id: VENUE_ID,
      name: 'The Stage',
      address: '1 Stage Road',
      city: 'Mumbai',
      state: 'Maharashtra',
      lat: 19.076,
      lng: 72.877,
      capacity: 100,
      seat_layout_id: 'layout-10x10',
    },
  })
  console.log('✓ Venue seeded')

  // Test user (used in Chunk 3 repository integration tests)
  await prisma.user.upsert({
    where: { id: USER_ID },
    update: {},
    create: {
      id: USER_ID,
      cognito_id: 'cognito-seed-test',
      email: 'seed-test@stagepass.dev',
      first_name: 'Seed',
      last_name: 'Test',
    },
  })
  console.log('✓ Test user seeded')

  // Event
  await prisma.event.upsert({
    where: { id: EVENT_ID },
    update: {},
    create: {
      id: EVENT_ID,
      title: 'Phase 1 Demo Concert',
      description: 'Demo event for Phase 1 testing',
      venue_id: VENUE_ID,
      start_at: new Date('2025-04-01T19:00:00Z'),
      end_at: new Date('2025-04-01T22:00:00Z'),
      status: 'LIVE',
      organizer_id: USER_ID,
    },
  })
  console.log('✓ Event seeded')

  // Price tiers
  const tiers = [
    { id: `${EVENT_ID}-general`, name: 'GENERAL', price: 50, seat_types: ['general'] },
    { id: `${EVENT_ID}-premium`, name: 'PREMIUM', price: 100, seat_types: ['premium'] },
    { id: `${EVENT_ID}-vip`, name: 'VIP', price: 200, seat_types: ['vip'] },
  ]
  for (const tier of tiers) {
    await prisma.priceTier.upsert({
      where: { id: tier.id },
      update: {},
      create: { ...tier, event_id: EVENT_ID },
    })
  }
  console.log('✓ Price tiers seeded')
}

async function seedDynamo() {
  let count = 0
  const items: DynamoDB.DocumentClient.WriteRequest[] = []

  for (const row of ROWS) {
    for (let i = 1; i <= SEATS_PER_ROW; i++) {
      const seatId = `${row}${i}`
      const { tierId } = tierForRow(row)

      items.push({
        PutRequest: {
          Item: {
            PK: SHOW_ID,
            SK: seatId,
            show_id: SHOW_ID,         // denormalized — required for show_id-status-index GSI
            seat_id: seatId,
            row,
            number: String(i),
            status: 'AVAILABLE',
            tier_id: tierId,
            held_by: null,
            hold_expires_at: null,    // Unix ms — set when held (see Chunk 3)
            hold_expires_at_ttl: null, // Unix seconds — used by DynamoDB TTL (see Chunk 3)
          },
        },
      })
      count++
    }
  }

  // DynamoDB BatchWrite accepts max 25 items per request
  for (let i = 0; i < items.length; i += 25) {
    await dynamo.batchWrite({
      RequestItems: {
        seats: items.slice(i, i + 25),
      },
    }).promise()
  }

  console.log(`✓ DynamoDB: ${count} seats seeded for show ${SHOW_ID}`)
}

async function main() {
  console.log('Seeding...\n')
  await seedPostgres()
  await seedDynamo()
  console.log('\nSeed complete.')
}

main()
  .catch((err) => {
    console.error('Seed failed:', err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
