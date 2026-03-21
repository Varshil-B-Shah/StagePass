import { DynamoDB } from 'aws-sdk'
import { config } from '../config'

const STREAM_TABLE = () => `${config.dynamo.table_prefix}stream_state`
const CHAT_TABLE   = () => `${config.dynamo.table_prefix}chat_messages`

export interface StreamState {
  event_id: string
  status: 'UPCOMING' | 'LIVE' | 'ENDED' | 'VOD_AVAILABLE'
  room_name: string
  went_live_at?: number
  vod_url?: string
}

export interface ChatMessage {
  event_id: string
  ts_id: string
  user_id: string
  display_name: string
  message: string
  is_ticket_holder: boolean
  ttl: number
}

export class StreamRepository {
  constructor(private readonly dynamo: DynamoDB.DocumentClient) {}

  /** Returns stream state (no sensitive fields — LiveKit has none) */
  async getStreamState(event_id: string): Promise<StreamState | null> {
    const result = await this.dynamo.get({
      TableName: STREAM_TABLE(),
      Key: { event_id },
      ProjectionExpression: 'event_id, #s, room_name, went_live_at, vod_url',
      ExpressionAttributeNames: { '#s': 'status' },
    }).promise()
    return (result.Item as StreamState) ?? null
  }

  async updateStatus(
    event_id: string,
    status: string,
    extra: Record<string, unknown> = {}
  ): Promise<void> {
    const extraKeys = Object.keys(extra)
    const setExpr = ['#s = :status', ...extraKeys.map((k) => `${k} = :${k}`)].join(', ')
    const attrValues: Record<string, unknown> = { ':status': status }
    for (const k of extraKeys) attrValues[`:${k}`] = extra[k]

    await this.dynamo.update({
      TableName: STREAM_TABLE(),
      Key: { event_id },
      UpdateExpression: `SET ${setExpr}`,
      ExpressionAttributeNames: { '#s': 'status' },
      ExpressionAttributeValues: attrValues,
    }).promise()
  }

  async getChatHistory(event_id: string): Promise<ChatMessage[]> {
    const result = await this.dynamo.query({
      TableName: CHAT_TABLE(),
      KeyConditionExpression: 'event_id = :eid',
      ExpressionAttributeValues: { ':eid': event_id },
      ScanIndexForward: false,
      Limit: 100,
    }).promise()
    return ((result.Items ?? []) as ChatMessage[]).reverse()
  }
}
