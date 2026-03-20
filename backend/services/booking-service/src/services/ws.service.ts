import { SNS } from 'aws-sdk'
import { config } from '../config'

export interface IWsService {
  broadcast(channel: string, payload: object): Promise<void>
}

class LocalWsService implements IWsService {
  async broadcast(channel: string, payload: object): Promise<void> {
    const res = await fetch(`${config.ws.server_url}/broadcast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel, payload }),
    })
    if (!res.ok) throw new Error(`WS broadcast failed: ${res.status}`)
  }
}

class SnsWsService implements IWsService {
  private readonly sns = new SNS({ region: config.dynamo.region })

  async broadcast(channel: string, payload: object): Promise<void> {
    const topicArn = process.env.SNS_SEAT_CHANGED_TOPIC_ARN
    if (!topicArn) throw new Error('SNS_SEAT_CHANGED_TOPIC_ARN not set')
    await this.sns
      .publish({ TopicArn: topicArn, Message: JSON.stringify({ channel, payload }) })
      .promise()
  }
}

export function createWsService(): IWsService {
  return config.ws.mode === 'local' ? new LocalWsService() : new SnsWsService()
}
