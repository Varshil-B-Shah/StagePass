import { RedisClientType } from 'redis'

export class RedisRepository {
  constructor(private readonly client: RedisClientType) {}

  async setHold(show_id: string, seat_id: string, user_id: string, ttl: number): Promise<void> {
    const pipeline = this.client.multi()
    // Primary expiry key — triggers keyspace notification on expire
    pipeline.set(`hold|${show_id}|${seat_id}`, user_id, { EX: ttl })
    // Per-user lookup key — guards against duplicate holds
    pipeline.lPush(`user_holds|${user_id}|${show_id}`, seat_id)
    pipeline.expire(`user_holds|${user_id}|${show_id}`, ttl)
    await pipeline.exec()
  }

  async getUserHolds(show_id: string, user_id: string): Promise<string[]> {
    return this.client.lRange(`user_holds|${user_id}|${show_id}`, 0, -1)
  }

  async delHold(show_id: string, seat_id: string, user_id: string): Promise<void> {
    const pipeline = this.client.multi()
    pipeline.del(`hold|${show_id}|${seat_id}`)
    pipeline.lRem(`user_holds|${user_id}|${show_id}`, 0, seat_id)
    await pipeline.exec()
  }
}
