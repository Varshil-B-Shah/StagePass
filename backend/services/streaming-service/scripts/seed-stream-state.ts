import 'dotenv/config'
import { DynamoDB } from 'aws-sdk'

const dynamo = new DynamoDB.DocumentClient({
  region: process.env.AWS_REGION || 'us-east-1',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
})

const TABLE = `${process.env.TABLE_PREFIX || 'dev_'}stream_state`

async function seed() {
  await dynamo.put({
    TableName: TABLE,
    Item: {
      event_id: 'EVT-001',
      status: 'UPCOMING',
      room_name: 'EVT-001',   // LiveKit room name = event_id
    },
  }).promise()

  console.log('Seeded dev_stream_state for EVT-001 (LiveKit room: EVT-001)')
}

seed().catch((err) => { console.error(err); process.exit(1) })
