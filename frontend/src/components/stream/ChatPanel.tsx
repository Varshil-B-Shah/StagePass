'use client'
import { useEffect, useRef, useState } from 'react'
import { ChatMessage } from './ChatMessage'
import { Button } from '@/components/ui/button'

interface Message {
  user_id: string
  display_name: string
  message: string
  is_ticket_holder: boolean
  ts: string
}

interface ChatPanelProps {
  event_id: string
  readOnly?: boolean   // true for VOD state — no input
}

export function ChatPanel({ event_id, readOnly = false }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const wsRef = useRef<WebSocket | null>(null)

  // Load history on mount
  useEffect(() => {
    fetch(`/api/streams/${encodeURIComponent(event_id)}/chat`)
      .then((r) => r.json())
      .then((data: { messages?: Message[] }) => {
        if (data.messages) setMessages(data.messages)
      })
      .catch(() => {})
  }, [event_id])

  // WebSocket: subscribe to chat channel and receive live messages
  useEffect(() => {
    if (readOnly) return

    let active = true

    const connect = async () => {
      const authRes = await fetch('/api/ws/auth').catch(() => null)
      if (!authRes?.ok || !active) return
      const { token } = await authRes.json() as { token: string }
      if (!active) return

      const wsUrl = `${process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:4000'}?token=${token}`
      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.onopen = () => {
        ws.send(JSON.stringify({ action: 'subscribe', channel: `chat:${event_id}` }))
      }

      ws.onmessage = (e) => {
        const payload = JSON.parse(e.data as string) as { type?: string } & Message
        if (payload.type === 'CHAT_MESSAGE') {
          setMessages((prev) => [...prev, payload])
        }
      }

      ws.onclose = () => {}
    }

    connect()

    return () => {
      active = false
      if (wsRef.current) { wsRef.current.onclose = null; wsRef.current.close() }
    }
  }, [event_id, readOnly])

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = () => {
    const text = input.trim()
    if (!text || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return
    wsRef.current.send(JSON.stringify({ action: 'chat', channel: `chat:${event_id}`, message: text }))
    setInput('')
  }

  return (
    <div className="flex flex-col h-full border rounded bg-white">
      <div className="px-3 py-2 border-b text-sm font-medium text-gray-700">
        Live Chat {readOnly && <span className="text-xs text-gray-400 ml-1">(read-only)</span>}
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-1 min-h-0">
        {messages.map((m, i) => (
          <ChatMessage key={i} {...m} />
        ))}
        <div ref={bottomRef} />
      </div>

      {!readOnly && (
        <div className="flex gap-2 p-2 border-t">
          <input
            type="text"
            className="flex-1 text-sm border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            placeholder="Say something…"
            value={input}
            maxLength={300}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') sendMessage() }}
          />
          <Button size="sm" onClick={sendMessage}>Send</Button>
        </div>
      )}
    </div>
  )
}
