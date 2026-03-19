import { DynamoDB } from 'aws-sdk'

const dynamo = new DynamoDB({
  endpoint: process.env.DYNAMODB_ENDPOINT || 'http://localhost:8000',
  region: process.env.AWS_REGION || 'us-east-1',
  accessKeyId: 'local',
  secretAccessKey: 'local',
})

async function createTable(params: DynamoDB.CreateTableInput): Promise<void> {
  try {
    await dynamo.createTable(params).promise()
    console.log(`✓ Created table: ${params.TableName}`)
  } catch (err: any) {
    if (err.code === 'ResourceInUseException') {
      console.log(`  Table already exists: ${params.TableName} — skipping`)
    } else {
      throw err
    }
  }
}

async function main() {
  // seats table
  // PK: show_id (composite: event_id#date#time), SK: seat_id (e.g. "A12")
  // GSI 1: show_id-status-index  — query all seats for a show by status
  // GSI 2: held_by-expires_at-index — query a user's active holds
  await createTable({
    TableName: 'seats',
    AttributeDefinitions: [
      { AttributeName: 'PK', AttributeType: 'S' },
      { AttributeName: 'SK', AttributeType: 'S' },
      { AttributeName: 'show_id', AttributeType: 'S' },
      { AttributeName: 'status', AttributeType: 'S' },
      { AttributeName: 'held_by', AttributeType: 'S' },
      { AttributeName: 'hold_expires_at', AttributeType: 'N' },
    ],
    KeySchema: [
      { AttributeName: 'PK', KeyType: 'HASH' },
      { AttributeName: 'SK', KeyType: 'RANGE' },
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'show_id-status-index',
        KeySchema: [
          { AttributeName: 'show_id', KeyType: 'HASH' },
          { AttributeName: 'status', KeyType: 'RANGE' },
        ],
        Projection: { ProjectionType: 'ALL' },
      },
      {
        IndexName: 'held_by-expires_at-index',
        KeySchema: [
          { AttributeName: 'held_by', KeyType: 'HASH' },
          { AttributeName: 'hold_expires_at', KeyType: 'RANGE' },
        ],
        Projection: { ProjectionType: 'ALL' },
      },
    ],
    BillingMode: 'PAY_PER_REQUEST',
  })

  // Enable TTL on the seats table.
  // hold_expires_at_ttl stores Unix SECONDS (not ms) — DynamoDB TTL requires seconds.
  // hold_expires_at stores Unix ms for code consistency.
  // Both fields are written together when a hold is created (see Chunk 3 seat.repository.ts).
  // DynamoDB TTL is a fallback cleanup only — Redis TTL fires first (see Chunk 4 redis.subscriber.ts).
  await dynamo.updateTimeToLive({
    TableName: 'seats',
    TimeToLiveSpecification: {
      Enabled: true,
      AttributeName: 'hold_expires_at_ttl',  // Unix seconds
    },
  }).promise()
  console.log('  TTL enabled on seats.hold_expires_at_ttl')

  // seat_types table
  // PK: venue_id, SK: seat_type_id
  // Read at seed time only — not queried at runtime in Phase 1
  await createTable({
    TableName: 'seat_types',
    AttributeDefinitions: [
      { AttributeName: 'PK', AttributeType: 'S' },
      { AttributeName: 'SK', AttributeType: 'S' },
    ],
    KeySchema: [
      { AttributeName: 'PK', KeyType: 'HASH' },
      { AttributeName: 'SK', KeyType: 'RANGE' },
    ],
    BillingMode: 'PAY_PER_REQUEST',
  })

  console.log('\nAll tables ready.')
}

main().catch((err) => {
  console.error('Failed to create tables:', err)
  process.exit(1)
})
