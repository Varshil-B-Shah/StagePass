import { RedisClientType } from 'redis'
import { config } from '../config'

export class RedisRepository {
  constructor(private readonly client: RedisClientType) {}

  async setHold(show_id: string, seat_id: string, user_id: string, ttl: number): Promise<void> {
    const prefix = config.redis_key_prefix
    const pipeline = this.client.multi()
    // Primary expiry key — triggers keyspace notification on expire
    pipeline.set(`${prefix}hold|${show_id}|${seat_id}`, user_id, { EX: ttl })
    // Per-user lookup key — guards against duplicate holds
    pipeline.lPush(`${prefix}user_holds|${user_id}|${show_id}`, seat_id)
    pipeline.expire(`${prefix}user_holds|${user_id}|${show_id}`, ttl)
    await pipeline.exec()
  }

  async getUserHolds(show_id: string, user_id: string): Promise<string[]> {
    const prefix = config.redis_key_prefix
    return this.client.lRange(`${prefix}user_holds|${user_id}|${show_id}`, 0, -1)
  }

  async delHold(show_id: string, seat_id: string, user_id: string): Promise<void> {
    const prefix = config.redis_key_prefix
    const pipeline = this.client.multi()
    pipeline.del(`${prefix}hold|${show_id}|${seat_id}`)
    pipeline.lRem(`${prefix}user_holds|${user_id}|${show_id}`, 0, seat_id)
    await pipeline.exec()
  }
}
