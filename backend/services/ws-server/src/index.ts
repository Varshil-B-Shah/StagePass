import 'dotenv/config'
import http from 'http'
import express from 'express'
import WebSocket, { WebSocketServer } from 'ws'
import jwt from 'jsonwebtoken'
import { DynamoDB } from 'aws-sdk'
import { Pool } from 'pg'
import { randomUUID } from 'crypto'

// ── DynamoDB client (lazy) ─────────────────────────────────────────────────────
const dynamo = new DynamoDB.DocumentClient({
  region: process.env.AWS_REGION || 'us-east-1',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
})
const TABLE_PREFIX = process.env.TABLE_PREFIX || 'dev_'
const CHAT_TABLE = `${TABLE_PREFIX}chat_messages`

// ── Postgres pool (lazy) ───────────────────────────────────────────────────────
const pgPool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL })
  : null

// ── WebSocket state ────────────────────────────────────────────────────────────

interface ConnMeta {
  userId: string
  email: string
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

// ── Chat persistence ───────────────────────────────────────────────────────────

async function isTicketHolder(userId: string, eventId: string): Promise<boolean> {
  if (!pgPool) return false
  try {
    const result = await pgPool.query(
      `SELECT id FROM "Booking" WHERE user_id = $1 AND event_id = $2 AND status = 'CONFIRMED' LIMIT 1`,
      [userId, eventId]
    )
    return (result.rowCount ?? 0) > 0
  } catch {
    return false
  }
}

async function persistChatMessage(params: {
  event_id: string
  user_id: string
  display_name: string
  message: string
  is_ticket_holder: boolean
}): Promise<string> {
  const ts_id = `${new Date().toISOString()}#${randomUUID()}`
  const ttl = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60  // 7 days

  await dynamo.put({
    TableName: CHAT_TABLE,
    Item: { ...params, ts_id, ttl },
  }).promise()

  return ts_id
}

// ── HTTP server ────────────────────────────────────────────────────────────────

export function createServer(): http.Server {
  const app = express()
  app.use(express.json())

  app.post('/broadcast', (req, res) => {
    const { channel, payload } = req.body as { channel: string; payload: object }
    const subscribers = channels.get(channel)
    if (!subscribers) { res.json({ delivered: 0 }); return }
    let delivered = 0
    for (const ws of subscribers) {
      if (ws.readyState === WebSocket.OPEN) { ws.send(JSON.stringify(payload)); delivered++ }
    }
    res.json({ delivered })
  })

  app.post('/internal/broadcast', (req, res) => {
    const { channel, event, data } = req.body as { channel: string; event: string; data: unknown }
    if (!channel || !event) { res.status(400).json({ error: 'channel and event required' }); return }
    const clients = channels.get(channel)
    if (!clients || clients.size === 0) { res.json({ ok: true, sent: 0 }); return }
    const message = JSON.stringify({ event, data })
    let sent = 0
    for (const ws of clients) {
      if (ws.readyState === WebSocket.OPEN) { ws.send(message); sent++ }
    }
    res.json({ ok: true, sent })
  })

  const server = http.createServer(app)
  const wss = new WebSocketServer({ server })

  wss.on('connection', (ws, req) => {
    const url = new URL(req.url ?? '/', `http://localhost`)
    const token = url.searchParams.get('token')

    if (!token) { ws.close(4001, 'Unauthorized: missing token'); return }

    let userId: string
    let email: string
    try {
      const secret = process.env.JWT_SECRET
      if (!secret) throw new Error('JWT_SECRET not set')
      const payload = jwt.verify(token, secret) as { sub?: string; email?: string }
      if (!payload.sub) throw new Error('Token missing sub claim')
      userId = payload.sub
      email = payload.email ?? userId
    } catch {
      ws.close(4001, 'Unauthorized: invalid token')
      return
    }

    connMeta.set(ws, { userId, email, channels: new Set() })
    subscribe(ws, `user:${userId}`)

    ws.on('message', (data) => {
      let message: { action: string; channel?: string; message?: string }
      try {
        message = JSON.parse(data.toString())
      } catch {
        ws.send(JSON.stringify({ error: 'Invalid JSON' }))
        return
      }

      // ── subscribe ────────────────────────────────────────────────────────────
      if (message.action === 'subscribe') {
        const ch = message.channel ?? ''
        // Allow show: channels (seat map) and chat: channels
        if (!ch.startsWith('show:') && !ch.startsWith('chat:')) {
          ws.send(JSON.stringify({ error: 'Invalid channel — only show: and chat: channels allowed' }))
          return
        }
        subscribe(ws, ch)
        ws.send(JSON.stringify({ action: 'subscribed', channel: ch }))
      }

      // ── unsubscribe ──────────────────────────────────────────────────────────
      if (message.action === 'unsubscribe') {
        unsubscribe(ws, message.channel ?? '')
      }

      // ── chat ─────────────────────────────────────────────────────────────────
      if (message.action === 'chat') {
        const ch = message.channel ?? ''
        const text = (message.message ?? '').trim()

        if (!ch.startsWith('chat:')) {
          ws.send(JSON.stringify({ error: 'chat action requires a chat: channel' }))
          return
        }
        if (!text || text.length > 300) {
          ws.send(JSON.stringify({ error: 'Message must be 1–300 characters' }))
          return
        }

        const event_id = ch.slice('chat:'.length)   // "chat:EVT-001" → "EVT-001"
        const meta = connMeta.get(ws)
        if (!meta) return

        const display_name = meta.email.includes('@')
          ? meta.email.split('@')[0]
          : meta.userId

        // Persist + broadcast (fire-and-forget; errors are non-fatal)
        isTicketHolder(meta.userId, event_id).then(async (isHolder) => {
          const ts_id = await persistChatMessage({
            event_id,
            user_id: meta.userId,
            display_name,
            message: text,
            is_ticket_holder: isHolder,
          })

          const payload = JSON.stringify({
            type: 'CHAT_MESSAGE',
            event_id,
            user_id: meta.userId,
            display_name,
            message: text,
            is_ticket_holder: isHolder,
            ts: ts_id.split('#')[0],   // ISO timestamp part
          })

          const subscribers = channels.get(ch)
          if (subscribers) {
            for (const sub of subscribers) {
              if (sub.readyState === WebSocket.OPEN) sub.send(payload)
            }
          }
        }).catch((err) => console.error('[ws-server] chat error:', err))
      }
    })

    ws.on('close', () => {
      const meta = connMeta.get(ws)
      if (meta) {
        for (const ch of meta.channels) { channels.get(ch)?.delete(ws) }
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
