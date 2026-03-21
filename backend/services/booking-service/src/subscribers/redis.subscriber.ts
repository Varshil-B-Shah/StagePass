import { createClient } from 'redis'
import { SeatService } from '../services/seat.service'
import { config } from '../config'

export class RedisSubscriber {
  private client: ReturnType<typeof createClient> | null = null

  constructor(private readonly seatService: SeatService) {}

  async start(): Promise<void> {
    this.client = createClient({ url: config.redis_url })
    this.client.on('error', (err) => console.error('[RedisSubscriber] error:', err))
    await this.client.connect()

    await this.client.configSet('notify-keyspace-events', 'Ex')

    const holdKeyPrefix = `${config.redis_key_prefix}hold|`

    await this.client.subscribe('__keyevent@0__:expired', async (key) => {
      if (!key.startsWith(holdKeyPrefix)) return

      // Strip prefix → `{show_id}|{seat_id}`
      const keyPart = key.slice(holdKeyPrefix.length)
      const lastPipe = keyPart.lastIndexOf('|')
      const show_id = keyPart.slice(0, lastPipe)
      const seat_id = keyPart.slice(lastPipe + 1)

      try {
        await this.seatService.releaseHold(show_id, seat_id)
        console.log(`[RedisSubscriber] Released expired hold: ${show_id}/${seat_id}`)
      } catch (err: any) {
        console.error(`[RedisSubscriber] Failed to release hold:`, err.message, { show_id, seat_id })
      }
    })

    console.log('[RedisSubscriber] Listening for expired hold keys')
  }

  async stop(): Promise<void> {
    await this.client?.disconnect()
  }
}
