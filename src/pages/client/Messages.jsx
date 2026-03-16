import { useState } from 'react'
import { Send } from 'lucide-react'
import { DEMO_MESSAGES } from '../../data/placeholder'
import { useAuth } from '../../context/AuthContext'

export default function Messages() {
  const { profile } = useAuth()
  const [messages, setMessages] = useState(DEMO_MESSAGES)
  const [input, setInput] = useState('')

  function send() {
    if (!input.trim()) return
    const newMsg = {
      id: `m-${Date.now()}`,
      client_id: 'c-001',
      sender_id: profile?.id ?? 'client-001',
      sender_name: profile?.full_name ?? 'You',
      sender_role: 'client',
      content: input.trim(),
      created_at: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, newMsg])
    setInput('')
  }

  function formatTime(iso) {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
    })
  }

  return (
    <div className="p-6 flex flex-col h-full max-h-screen">
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-vc-text">Messages</h1>
        <p className="text-sm text-vc-muted mt-0.5">Your VirtueCore team</p>
      </div>

      <div className="flex-1 border border-vc-border flex flex-col">
        {/* Thread */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg) => {
            const isMe = msg.sender_role === 'client'
            return (
              <div key={msg.id} className={`flex gap-3 ${isMe ? 'flex-row-reverse' : ''}`}>
                <div className={`w-7 h-7 flex-shrink-0 flex items-center justify-center text-xs font-bold ${
                  isMe ? 'bg-vc-secondary text-vc-muted' : 'bg-gold text-white'
                }`}>
                  {msg.sender_name[0]}
                </div>
                <div className={`max-w-md ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium text-vc-text">{msg.sender_name}</span>
                    <span className="text-xs text-vc-muted">{formatTime(msg.created_at)}</span>
                  </div>
                  <div className={`px-3 py-2 text-sm ${
                    isMe
                      ? 'bg-vc-text text-white'
                      : 'bg-vc-secondary text-vc-text border border-vc-border'
                  }`}>
                    {msg.content}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Input */}
        <div className="border-t border-vc-border p-3 flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && send()}
            placeholder="Type a message..."
            className="flex-1 border border-vc-border px-3 py-2 text-sm focus:outline-none focus:border-vc-text"
          />
          <button
            onClick={send}
            className="px-3 py-2 bg-vc-text text-white hover:bg-gray-800 transition-colors"
          >
            <Send size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}
