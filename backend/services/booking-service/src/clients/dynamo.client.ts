import { DynamoDB } from 'aws-sdk'
import { config } from '../config'

let client: DynamoDB.DocumentClient | null = null

export function getDynamoClient(): DynamoDB.DocumentClient {
  if (!client) {
    client = new DynamoDB.DocumentClient({
      endpoint: config.dynamo.endpoint,
      region: config.dynamo.region,
      accessKeyId: config.dynamo.access_key_id,
      secretAccessKey: config.dynamo.secret_access_key,
    })
  }
  return client
}
