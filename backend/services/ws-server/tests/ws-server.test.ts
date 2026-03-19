import http from 'http'
import WebSocket from 'ws'
import jwt from 'jsonwebtoken'
import request from 'supertest'
import { createServer, resetState } from '../src/index'

const JWT_SECRET = 'test-ws-secret'
process.env.JWT_SECRET = JWT_SECRET

async function startServer(port: number): Promise<http.Server> {
  resetState()
  const server = createServer()
  await new Promise<void>((resolve) => server.listen(port, resolve))
  return server
}

function makeToken(sub = 'user-test') {
  return jwt.sign({ sub }, JWT_SECRET, { expiresIn: '1h' })
}

function wsConnect(port: number, token?: string): Promise<WebSocket> {
  const url = token
    ? `ws://localhost:${port}?token=${token}`
    : `ws://localhost:${port}`
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url)
    ws.on('open', () => resolve(ws))
    ws.on('error', reject)
    ws.on('unexpected-response', (_req, res) => {
      reject(new Error(`Unexpected response: ${res.statusCode}`))
    })
  })
}

function waitForClose(ws: WebSocket): Promise<{ code: number; reason: string }> {
  return new Promise((resolve) =>
    ws.on('close', (code, reason) => resolve({ code, reason: reason.toString() }))
  )
}

function waitForMessage(ws: WebSocket): Promise<object> {
  return new Promise((resolve) =>
    ws.once('message', (data) => resolve(JSON.parse(data.toString())))
  )
}

describe('WebSocket authentication', () => {
  let server: http.Server
  const PORT = 14001

  beforeAll(async () => { server = await startServer(PORT) })
  afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())))

  it('closes with code 4001 when token is missing', async () => {
    const ws = new WebSocket(`ws://localhost:${PORT}`)
    ws.on('error', () => {})
    const { code } = await waitForClose(ws)
    expect(code).toBe(4001)
  })

  it('closes with code 4001 when token is invalid', async () => {
    const ws = new WebSocket(`ws://localhost:${PORT}?token=bad.token.here`)
    ws.on('error', () => {})
    const { code } = await waitForClose(ws)
    expect(code).toBe(4001)
  })

  it('stays open and auto-subscribes to user channel with valid token', async () => {
    const ws = await wsConnect(PORT, makeToken('user-abc'))
    expect(ws.readyState).toBe(WebSocket.OPEN)
    ws.close()
  })
})

describe('Channel subscription', () => {
  let server: http.Server
  const PORT = 14002

  beforeAll(async () => { server = await startServer(PORT) })
  afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())))

  it('sends subscribed acknowledgement after subscribe message', async () => {
    const ws = await wsConnect(PORT, makeToken())
    const msgPromise = waitForMessage(ws)
    ws.send(JSON.stringify({ action: 'subscribe', channel: 'show:EVT-001#2025-04-01#19:00' }))
    const msg = await msgPromise
    expect(msg).toEqual({ action: 'subscribed', channel: 'show:EVT-001#2025-04-01#19:00' })
    ws.close()
  })

  it('rejects subscribe to non-show channels', async () => {
    const ws = await wsConnect(PORT, makeToken())
    const msgPromise = waitForMessage(ws)
    ws.send(JSON.stringify({ action: 'subscribe', channel: 'admin:all' }))
    const msg = await msgPromise
    expect(msg).toMatchObject({ error: expect.any(String) })
    ws.close()
  })
})

describe('POST /broadcast', () => {
  let server: http.Server
  const PORT = 14003

  beforeAll(async () => { server = await startServer(PORT) })
  afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())))

  it('delivers payload to subscribed clients and returns delivered count', async () => {
    const ws = await wsConnect(PORT, makeToken('user-1'))

    const subAck = waitForMessage(ws)
    ws.send(JSON.stringify({ action: 'subscribe', channel: 'show:EVT-001#2025-04-01#19:00' }))
    await subAck

    const payloadReceived = waitForMessage(ws)
    const res = await request(server)
      .post('/broadcast')
      .send({ channel: 'show:EVT-001#2025-04-01#19:00', payload: { seat_id: 'A1', status: 'HELD' } })
    expect(res.status).toBe(200)
    expect(res.body.delivered).toBe(1)

    const received = await payloadReceived
    expect(received).toEqual({ seat_id: 'A1', status: 'HELD' })

    ws.close()
  })

  it('returns delivered 0 when no clients on channel', async () => {
    const res = await request(server)
      .post('/broadcast')
      .send({ channel: 'show:nobody', payload: { seat_id: 'Z9' } })
    expect(res.status).toBe(200)
    expect(res.body.delivered).toBe(0)
  })

  it('auto-delivers to user personal channel', async () => {
    const ws = await wsConnect(PORT, makeToken('user-personal'))

    const payloadReceived = waitForMessage(ws)
    await request(server)
      .post('/broadcast')
      .send({ channel: 'user:user-personal', payload: { type: 'HOLD_EXPIRED', seat_id: 'B3' } })

    const received = await payloadReceived
    expect(received).toMatchObject({ type: 'HOLD_EXPIRED' })

    ws.close()
  })
})
