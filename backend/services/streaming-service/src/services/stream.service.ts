import { StreamRepository } from '../repositories/stream.repository'
import { BookingRepository } from '../repositories/booking.repository'
import { createLiveKitToken } from '../lib/livekit'

export class StreamService {
  constructor(
    private readonly streamRepo: StreamRepository,
    private readonly bookingRepo: BookingRepository,
  ) {}

  async getStatus(event_id: string) {
    const state = await this.streamRepo.getStreamState(event_id)
    if (!state) return null
    return {
      status: state.status,
      went_live_at: state.went_live_at ?? null,
      vod_url: state.vod_url ?? null,
    }
  }

  async getPlaybackToken(event_id: string, user_id: string) {
    const hasBooking = await this.bookingRepo.hasConfirmedBooking(user_id, event_id)
    if (!hasBooking) return null

    const state = await this.streamRepo.getStreamState(event_id)
    if (!state) return null

    const token = await createLiveKitToken(state.room_name, user_id)
    return { token }
  }

  async getChatHistory(event_id: string) {
    return this.streamRepo.getChatHistory(event_id)
  }

  /** Called by LiveKit webhook when a room/ingress starts */
  async handleRoomStarted(room_name: string): Promise<void> {
    await this.streamRepo.updateStatus(room_name, 'LIVE', {
      went_live_at: Math.floor(Date.now() / 1000),
    })
  }

  /** Called by LiveKit webhook when a room finishes */
  async handleRoomFinished(room_name: string): Promise<void> {
    await this.streamRepo.updateStatus(room_name, 'ENDED')
  }
}
