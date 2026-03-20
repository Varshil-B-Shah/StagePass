import 'dotenv/config'
import http from 'http'
import express from 'express'
import WebSocket, { WebSocketServer } from 'ws'
import jwt from 'jsonwebtoken'

interface ConnMeta {
  userId: string
  channels: Set<string>
}

let connMeta = new WeakMap<WebSocket, ConnMeta>()
let channels = new Map<string, Set<WebSocket>>()

export function resetState(): void {
  channels = new Map()
  connMeta = new WeakMap()
}

function subscribe(ws: WebSocket, channel: string): void {
  if (!channels.has(channel)) channels.set(channel, new Set())
  channels.get(channel)!.add(ws)
  connMeta.get(ws)?.channels.add(channel)
}

function unsubscribe(ws: WebSocket, channel: string): void {
  channels.get(channel)?.delete(ws)
  connMeta.get(ws)?.channels.delete(channel)
}

export function createServer(): http.Server {
  const app = express()
  app.use(express.json())

  app.post('/broadcast', (req, res) => {
    const { channel, payload } = req.body as { channel: string; payload: object }
    const subscribers = channels.get(channel)
    if (!subscribers) {
      res.json({ delivered: 0 })
      return
    }
    let delivered = 0
    for (const ws of subscribers) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(payload))
        delivered++
      }
    }
    res.json({ delivered })
  })

  app.post('/internal/broadcast', (req, res) => {
    const { channel, event, data } = req.body as { channel: string; event: string; data: unknown }
    if (!channel || !event) {
      res.status(400).json({ error: 'channel and event required' })
      return
    }
    const clients = channels.get(channel)
    if (!clients || clients.size === 0) {
      res.json({ ok: true, sent: 0 })
      return
    }
    const message = JSON.stringify({ event, data })
    let sent = 0
    for (const ws of clients) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message)
        sent++
      }
    }
    res.json({ ok: true, sent })
  })

  const server = http.createServer(app)
  const wss = new WebSocketServer({ server })

  wss.on('connection', (ws, req) => {
    const url = new URL(req.url ?? '/', `http://localhost`)
    const token = url.searchParams.get('token')

    if (!token) {
      ws.close(4001, 'Unauthorized: missing token')
      return
    }

    let userId: string
    try {
      const secret = process.env.JWT_SECRET
      if (!secret) throw new Error('JWT_SECRET not set')
      const payload = jwt.verify(token, secret) as { sub?: string }
      if (!payload.sub) throw new Error('Token missing sub claim')
      userId = payload.sub
    } catch {
      ws.close(4001, 'Unauthorized: invalid token')
      return
    }

    connMeta.set(ws, { userId, channels: new Set() })
    subscribe(ws, `user:${userId}`)

    ws.on('message', (data) => {
      let message: { action: string; channel: string }
      try {
        message = JSON.parse(data.toString())
      } catch {
        ws.send(JSON.stringify({ error: 'Invalid JSON' }))
        return
      }

      if (message.action === 'subscribe') {
        if (!message.channel.startsWith('show:')) {
          ws.send(JSON.stringify({ error: 'Invalid channel — only show: channels allowed' }))
          return
        }
        subscribe(ws, message.channel)
        ws.send(JSON.stringify({ action: 'subscribed', channel: message.channel }))
      }

      if (message.action === 'unsubscribe') {
        unsubscribe(ws, message.channel)
      }
    })

    ws.on('close', () => {
      const meta = connMeta.get(ws)
      if (meta) {
        for (const ch of meta.channels) {
          channels.get(ch)?.delete(ws)
        }
        connMeta.delete(ws)
      }
    })
  })

  return server
}

if (require.main === module) {
  const PORT = parseInt(process.env.PORT ?? '4000', 10)
  createServer().listen(PORT, () => {
    console.log(`[ws-server] listening on :${PORT}`)
  })
}
