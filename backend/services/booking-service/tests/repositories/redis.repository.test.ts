import 'dotenv/config'
import { RedisRepository } from '../../src/repositories/redis.repository'
import {
  getTestRedisClient,
  clearHoldKeys,
  TEST_SHOW_ID,
  TEST_SEAT_ID,
  TEST_USER_ID,
} from '../setup/db-setup'

let repo: RedisRepository

beforeAll(async () => {
  const client = await getTestRedisClient()
  repo = new RedisRepository(client as any)
})

beforeEach(async () => {
  await clearHoldKeys()
})

describe('RedisRepository.setHold', () => {
  it('writes both hold| and user_holds| keys with correct TTL', async () => {
    await repo.setHold(TEST_SHOW_ID, TEST_SEAT_ID, TEST_USER_ID, 60)

    const client = await getTestRedisClient()

    const holdVal = await client.get(`hold|${TEST_SHOW_ID}|${TEST_SEAT_ID}`)
    expect(holdVal).toBe(TEST_USER_ID)

    const ttl = await client.ttl(`hold|${TEST_SHOW_ID}|${TEST_SEAT_ID}`)
    expect(ttl).toBeGreaterThan(55)
    expect(ttl).toBeLessThanOrEqual(60)

    const userHolds = await client.lRange(`user_holds|${TEST_USER_ID}|${TEST_SHOW_ID}`, 0, -1)
    expect(userHolds).toContain(TEST_SEAT_ID)
  })
})

describe('RedisRepository.getUserHolds', () => {
  it('returns empty array when no holds exist', async () => {
    const holds = await repo.getUserHolds(TEST_SHOW_ID, TEST_USER_ID)
    expect(holds).toEqual([])
  })

  it('returns seat_ids after a hold is set', async () => {
    await repo.setHold(TEST_SHOW_ID, TEST_SEAT_ID, TEST_USER_ID, 60)
    const holds = await repo.getUserHolds(TEST_SHOW_ID, TEST_USER_ID)
    expect(holds).toContain(TEST_SEAT_ID)
  })
})

describe('RedisRepository.delHold', () => {
  it('removes both hold| and user_holds| keys', async () => {
    await repo.setHold(TEST_SHOW_ID, TEST_SEAT_ID, TEST_USER_ID, 60)
    await repo.delHold(TEST_SHOW_ID, TEST_SEAT_ID, TEST_USER_ID)

    const client = await getTestRedisClient()
    const holdVal = await client.get(`hold|${TEST_SHOW_ID}|${TEST_SEAT_ID}`)
    expect(holdVal).toBeNull()

    const userHolds = await client.lRange(`user_holds|${TEST_USER_ID}|${TEST_SHOW_ID}`, 0, -1)
    expect(userHolds).not.toContain(TEST_SEAT_ID)
  })
})
