import { AccessToken } from 'livekit-server-sdk'
import { config } from '../config'

/** Creates a LiveKit viewer token for the given room. Expires in 12h. */
export function createLiveKitToken(roomName: string, userId: string): Promise<string> {
  const token = new AccessToken(config.livekit.api_key, config.livekit.api_secret, {
    identity: userId,
    ttl: '12h',
  })
  token.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: false,
    canSubscribe: true,
  })
  return token.toJwt()
}
