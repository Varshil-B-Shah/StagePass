import { createClient, RedisClientType } from 'redis'
import { config } from '../config'

let client: RedisClientType | null = null

export async function getRedisClient(): Promise<RedisClientType> {
  if (!client) {
    client = createClient({ url: config.redis_url }) as RedisClientType
    client.on('error', (err) => console.error('[Redis] client error:', err))
    await client.connect()
  }
  return client
}
