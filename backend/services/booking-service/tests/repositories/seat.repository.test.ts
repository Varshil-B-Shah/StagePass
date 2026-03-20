import 'dotenv/config'
import { DynamoDB } from 'aws-sdk'
import { SeatRepository } from '../../src/repositories/seat.repository'
import {
  resetSeat,
  TEST_SHOW_ID,
  TEST_SEAT_ID,
  TEST_USER_ID,
} from '../setup/db-setup'

const dynamo = new DynamoDB.DocumentClient({
  endpoint: process.env.DYNAMODB_ENDPOINT || 'http://localhost:8000',
  region: 'us-east-1',
  accessKeyId: 'local',
  secretAccessKey: 'local',
})

let repo: SeatRepository

beforeAll(() => {
  repo = new SeatRepository(dynamo)
})

beforeEach(async () => {
  await resetSeat()
})

describe('SeatRepository.getSeatMap', () => {
  it('returns all 100 seats for the test show', async () => {
    const seats = await repo.getSeatMap(TEST_SHOW_ID)
    expect(seats).toHaveLength(100)
    expect(seats[0]).toMatchObject({
      seat_id: expect.any(String),
      status: 'AVAILABLE',
      tier_id: expect.any(String),
    })
  })
})

describe('SeatRepository.getSeat', () => {
  it('returns the seat item for a valid show_id + seat_id', async () => {
    const seat = await repo.getSeat(TEST_SHOW_ID, TEST_SEAT_ID)
    expect(seat).not.toBeNull()
    expect(seat?.seat_id).toBe(TEST_SEAT_ID)
    expect(seat?.status).toBe('AVAILABLE')
  })

  it('returns null for a non-existent seat', async () => {
    const seat = await repo.getSeat(TEST_SHOW_ID, 'Z99')
    expect(seat).toBeNull()
  })
})

describe('SeatRepository.holdSeat', () => {
  it('transitions seat from AVAILABLE to HELD', async () => {
    const expiry = Date.now() + 60_000
    await repo.holdSeat({
      show_id: TEST_SHOW_ID,
      seat_id: TEST_SEAT_ID,
      user_id: TEST_USER_ID,
      hold_expires_at: expiry,
    })

    const seat = await repo.getSeat(TEST_SHOW_ID, TEST_SEAT_ID)
    expect(seat?.status).toBe('HELD')
    expect(seat?.held_by).toBe(TEST_USER_ID)
    expect(seat?.hold_expires_at).toBe(expiry)
    // TTL must be stored in seconds for DynamoDB TTL to work
    expect(seat?.hold_expires_at_ttl).toBe(Math.floor(expiry / 1000))
  })

  it('throws ConditionalCheckFailedException when seat is already HELD', async () => {
    const expiry = Date.now() + 60_000
    await repo.holdSeat({
      show_id: TEST_SHOW_ID,
      seat_id: TEST_SEAT_ID,
      user_id: TEST_USER_ID,
      hold_expires_at: expiry,
    })

    await expect(
      repo.holdSeat({
        show_id: TEST_SHOW_ID,
        seat_id: TEST_SEAT_ID,
        user_id: 'user-other',
        hold_expires_at: expiry,
      })
    ).rejects.toMatchObject({ code: 'ConditionalCheckFailedException' })
  })
})

describe('SeatRepository.releaseSeat', () => {
  it('transitions seat from HELD back to AVAILABLE', async () => {
    const expiry = Date.now() + 60_000
    await repo.holdSeat({ show_id: TEST_SHOW_ID, seat_id: TEST_SEAT_ID, user_id: TEST_USER_ID, hold_expires_at: expiry })
    await repo.releaseSeat(TEST_SHOW_ID, TEST_SEAT_ID)

    const seat = await repo.getSeat(TEST_SHOW_ID, TEST_SEAT_ID)
    expect(seat?.status).toBe('AVAILABLE')
    // DynamoDB REMOVE deletes the attribute entirely — getSeat normalises absent attrs to null
    expect(seat?.held_by).toBeNull()
  })
})

describe('SeatRepository.confirmSeat', () => {
  it('transitions seat from HELD to BOOKED and sets booked_by', async () => {
    const expiry = Date.now() + 60_000
    await repo.holdSeat({ show_id: TEST_SHOW_ID, seat_id: TEST_SEAT_ID, user_id: TEST_USER_ID, hold_expires_at: expiry })
    await repo.confirmSeat(TEST_SHOW_ID, TEST_SEAT_ID, TEST_USER_ID)

    const seat = await repo.getSeat(TEST_SHOW_ID, TEST_SEAT_ID)
    expect(seat?.status).toBe('BOOKED')
    expect(seat?.booked_by).toBe(TEST_USER_ID)
  })
})

describe('SeatRepository.getUserHoldsFromDynamo', () => {
  it('returns seats held by a user for a given show', async () => {
    const expiry = Date.now() + 60_000
    await repo.holdSeat({ show_id: TEST_SHOW_ID, seat_id: TEST_SEAT_ID, user_id: TEST_USER_ID, hold_expires_at: expiry })

    const holds = await repo.getUserHoldsFromDynamo(TEST_SHOW_ID, TEST_USER_ID)
    expect(holds).toHaveLength(1)
    expect(holds[0].seat_id).toBe(TEST_SEAT_ID)
    expect(holds[0].hold_expires_at).toBe(expiry)
  })

  it('returns empty array when user holds nothing', async () => {
    const holds = await repo.getUserHoldsFromDynamo(TEST_SHOW_ID, 'user-nobody')
    expect(holds).toEqual([])
  })
})
