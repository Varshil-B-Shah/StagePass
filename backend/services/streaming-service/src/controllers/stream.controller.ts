import { Request, Response, NextFunction } from 'express'
import { WebhookReceiver } from 'livekit-server-sdk'
import { StreamService } from '../services/stream.service'
import { config } from '../config'

export class StreamController {
  constructor(private readonly streamService: StreamService) {}

  getStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { event_id } = req.params
      const status = await this.streamService.getStatus(event_id)
      if (!status) return res.status(404).json({ error: 'Stream not found' })
      return res.json(status)
    } catch (err) { next(err) }
  }

  getToken = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { event_id } = req.params
      const user_id = req.user?.sub
      if (!user_id) return res.status(401).json({ error: 'Unauthorized' })

      const result = await this.streamService.getPlaybackToken(event_id, user_id)
      if (!result) return res.status(403).json({ error: 'No confirmed booking for this event' })
      return res.json(result)
    } catch (err) { next(err) }
  }

  getChatHistory = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { event_id } = req.params
      const messages = await this.streamService.getChatHistory(event_id)
      return res.json({ messages })
    } catch (err) { next(err) }
  }

  handleWebhook = async (req: Request, res: Response) => {
    try {
      const receiver = new WebhookReceiver(config.livekit.api_key, config.livekit.api_secret)
      const event = await receiver.receive(req.body as string, req.headers.authorization ?? '')

      if (event.event === 'room_started' && event.room?.name) {
        await this.streamService.handleRoomStarted(event.room.name)
      } else if (event.event === 'room_finished' && event.room?.name) {
        await this.streamService.handleRoomFinished(event.room.name)
      }

      res.status(200).json({ ok: true })
    } catch (err) {
      console.error('[streaming-service] webhook error:', err)
      res.status(400).json({ error: 'Invalid webhook' })
    }
  }
}
