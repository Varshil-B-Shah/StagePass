import { DynamoDB } from 'aws-sdk'
import { config } from '../config'

export interface SeatItem {
  PK: string
  SK: string
  show_id: string
  seat_id: string
  row: string
  number: string
  status: 'AVAILABLE' | 'HELD' | 'RESERVED' | 'BOOKED' | 'BLOCKED'
  tier_id: string
  held_by: string | null
  hold_expires_at: number | null
  hold_expires_at_ttl: number | null
  booked_by?: string | null
}

export interface HoldSeatInput {
  show_id: string
  seat_id: string
  user_id: string
  hold_expires_at: number  // Unix ms
}

export interface UserHoldResult {
  seat_id: string
  hold_expires_at: number
}

const TABLE = () => `${config.dynamo.table_prefix}seats`

export class SeatRepository {
  constructor(private readonly dynamo: DynamoDB.DocumentClient) {}

  async getSeatMap(show_id: string): Promise<SeatItem[]> {
    const result = await this.dynamo
      .query({
        TableName: TABLE(),
        KeyConditionExpression: 'PK = :show',
        ExpressionAttributeValues: { ':show': show_id },
      })
      .promise()
    return (result.Items || []) as SeatItem[]
  }

  async getSeat(show_id: string, seat_id: string): Promise<SeatItem | null> {
    const result = await this.dynamo
      .get({
        TableName: TABLE(),
        Key: { PK: show_id, SK: seat_id },
      })
      .promise()
    if (!result.Item) return null
    // Normalise absent attributes (removed via DynamoDB REMOVE) to null
    const item = result.Item as Record<string, unknown>
    return {
      ...item,
      held_by: item['held_by'] ?? null,
      hold_expires_at: item['hold_expires_at'] ?? null,
      hold_expires_at_ttl: item['hold_expires_at_ttl'] ?? null,
      booked_by: item['booked_by'] ?? null,
    } as SeatItem
  }

  async holdSeat(input: HoldSeatInput): Promise<void> {
    const { show_id, seat_id, user_id, hold_expires_at } = input
    // hold_expires_at_ttl: DynamoDB TTL needs Unix seconds (not ms)
    const hold_expires_at_ttl = Math.floor(hold_expires_at / 1000)

    await this.dynamo
      .update({
        TableName: TABLE(),
        Key: { PK: show_id, SK: seat_id },
        UpdateExpression:
          'SET #status = :held, held_by = :userId, hold_expires_at = :expiry, hold_expires_at_ttl = :ttl',
        ConditionExpression: '#status = :available',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: {
          ':available': 'AVAILABLE',
          ':held': 'HELD',
          ':userId': user_id,
          ':expiry': hold_expires_at,
          ':ttl': hold_expires_at_ttl,
        },
      })
      .promise()
  }

  /** Transition seat from HELD → RESERVED atomically.
   *  Used by /api/bookings/checkout before payment is initiated. */
  async reserveSeat(show_id: string, seat_id: string, user_id: string): Promise<void> {
    await this.dynamo
      .update({
        TableName: TABLE(),
        Key: { PK: show_id, SK: seat_id },
        UpdateExpression: 'SET #status = :reserved',
        ConditionExpression: '#status = :held AND held_by = :userId',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: {
          ':reserved': 'RESERVED',
          ':held': 'HELD',
          ':userId': user_id,
        },
      })
      .promise()
  }

  /** Transition seat from RESERVED → BOOKED (called by ConfirmBooking Lambda). */
  async confirmReservedSeat(show_id: string, seat_id: string): Promise<void> {
    await this.dynamo
      .update({
        TableName: TABLE(),
        Key: { PK: show_id, SK: seat_id },
        UpdateExpression:
          'SET #status = :booked REMOVE held_by, hold_expires_at, hold_expires_at_ttl',
        ConditionExpression: '#status = :reserved',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: {
          ':booked': 'BOOKED',
          ':reserved': 'RESERVED',
        },
      })
      .promise()
  }

  /** Release a RESERVED seat back to AVAILABLE (called by ExpireHold Lambda on timeout). */
  async releaseReservedSeat(show_id: string, seat_id: string): Promise<void> {
    await this.dynamo
      .update({
        TableName: TABLE(),
        Key: { PK: show_id, SK: seat_id },
        UpdateExpression:
          'SET #status = :available REMOVE held_by, hold_expires_at, hold_expires_at_ttl',
        ConditionExpression: '#status = :reserved',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: { ':available': 'AVAILABLE', ':reserved': 'RESERVED' },
      })
      .promise()
  }

  async releaseSeat(show_id: string, seat_id: string): Promise<void> {
    await this.dynamo
      .update({
        TableName: TABLE(),
        Key: { PK: show_id, SK: seat_id },
        UpdateExpression:
          'SET #status = :available REMOVE held_by, hold_expires_at, hold_expires_at_ttl',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: { ':available': 'AVAILABLE' },
      })
      .promise()
  }

  async confirmSeat(show_id: string, seat_id: string, user_id: string): Promise<void> {
    await this.dynamo
      .update({
        TableName: TABLE(),
        Key: { PK: show_id, SK: seat_id },
        UpdateExpression:
          'SET #status = :booked, booked_by = :userId REMOVE held_by, hold_expires_at, hold_expires_at_ttl',
        ConditionExpression: '#status = :held AND held_by = :userId',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: {
          ':booked': 'BOOKED',
          ':held': 'HELD',
          ':userId': user_id,
        },
      })
      .promise()
  }

  /** Fallback: query DynamoDB for a user's active holds (used when Redis is stale). */
  async getUserHoldsFromDynamo(
    show_id: string,
    user_id: string
  ): Promise<UserHoldResult[]> {
    const result = await this.dynamo
      .query({
        TableName: TABLE(),
        IndexName: 'held_by-expires_at-index',
        KeyConditionExpression: 'held_by = :userId',
        FilterExpression: 'show_id = :show AND #status = :held',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: {
          ':userId': user_id,
          ':show': show_id,
          ':held': 'HELD',
        },
      })
      .promise()

    return (result.Items || []).map((item) => ({
      seat_id: item.seat_id as string,
      hold_expires_at: item.hold_expires_at as number,
    }))
  }
}
