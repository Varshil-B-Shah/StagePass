interface ChatMessageProps {
  display_name: string
  message: string
  is_ticket_holder: boolean
  ts: string
}

export function ChatMessage({ display_name, message, is_ticket_holder }: ChatMessageProps) {
  return (
    <div className="flex gap-2 text-sm py-1">
      <span className="font-semibold text-gray-800 shrink-0">
        {display_name}
        {is_ticket_holder && (
          <span className="ml-1 text-xs bg-indigo-100 text-indigo-700 px-1 rounded">🎫</span>
        )}
      </span>
      <span className="text-gray-600 break-words">{message}</span>
    </div>
  )
}
