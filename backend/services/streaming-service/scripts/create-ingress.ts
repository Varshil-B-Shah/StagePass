import 'dotenv/config'
import { IngressClient, IngressInput } from 'livekit-server-sdk'

async function createIngress() {
  const { LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET } = process.env

  if (!LIVEKIT_URL || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
    throw new Error('Missing LIVEKIT_URL, LIVEKIT_API_KEY, or LIVEKIT_API_SECRET in .env')
  }

  const client = new IngressClient(LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET)

  const ingress = await client.createIngress(IngressInput.RTMP_INPUT, {
    name: 'stagepass-dev',
    roomName: 'EVT-001',        // must match the event_id used in seed
    participantIdentity: 'broadcaster',
    participantName: 'Broadcaster',
  })

  console.log('\n✅ Ingress created!\n')
  console.log('Copy these into OBS (Settings → Stream):')
  console.log('  Server (URL):', ingress.url)
  console.log('  Stream Key:  ', ingress.streamKey)
  console.log('\nIngress ID:', ingress.ingressId)
  console.log('Status:', ingress.state?.status)
}

createIngress().catch((err) => { console.error(err); process.exit(1) })
