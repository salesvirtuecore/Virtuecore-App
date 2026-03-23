import { useMemo, useState } from 'react'
import { Bot, MessageCircle, Send, X } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useLocation } from 'react-router-dom'

function generateReply(input, role) {
  const text = input.toLowerCase()

  if (text.includes('invoice') || text.includes('payment') || text.includes('billing')) {
    return role === 'admin'
      ? 'For billing issues, open Revenue to review invoice status and payment history. If Stripe status looks wrong, refresh and check the Integrations page.'
      : 'For invoice questions, open Invoices or Billing in the left menu. If a payment still looks pending after paying, wait a minute then refresh.'
  }

  if (text.includes('meeting') || text.includes('call') || text.includes('calendly')) {
    return 'You can book directly in Meetings. After booking, upcoming calls should appear in-app automatically. If not, refresh once and check again in a few seconds.'
  }

  if (text.includes('deliverable') || text.includes('task') || text.includes('va')) {
    return role === 'va'
      ? 'Use Task Board for assignment status and Time Tracker for logged work. If a task is missing, ask your admin to confirm client/task mapping.'
      : 'Deliverables are tracked in Deliverables. You can approve or request changes there, and updates should sync for the team.'
  }

  if (text.includes('client') || text.includes('onboarding') || text.includes('invite')) {
    return 'Invite clients from the Clients page. Once they sign up, their portal status should switch from Invited to Joined and onboarding status should update automatically.'
  }

  if (text.includes('error') || text.includes('bug') || text.includes('not work') || text.includes('broken')) {
    return 'Try a hard refresh first. If it still fails, share the exact page and message, and I can guide you to the fastest fix.'
  }

  return 'I can help with meetings, invoices, onboarding, tasks, and portal issues. Tell me what page you are on and what you want to do.'
}

export default function HelpChatWidget() {
  const { profile } = useAuth()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      text: 'Hi, I am your VirtueCore assistant. Ask me anything about using the app.',
    },
  ])

  const quickPrompts = useMemo(() => {
    if (profile?.role === 'admin') {
      return ['How do invites update?', 'Where do I check payments?', 'Why is a client not showing?']
    }
    if (profile?.role === 'va') {
      return ['Where are my tasks?', 'How do I log time?', 'How do I submit standup?']
    }
    return ['How do I book a meeting?', 'Where are my invoices?', 'How do I review deliverables?']
  }, [profile?.role])

  async function pushUserAndReply(text) {
    const trimmed = text.trim()
    if (!trimmed || sending) return

    const userMessage = { id: `u-${Date.now()}`, role: 'user', text: trimmed }
    const historySnapshot = [...messages, userMessage]
    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setSending(true)

    try {
      const response = await fetch('/api/admin/help-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          messages: historySnapshot,
          role: profile?.role || 'client',
          page: location.pathname,
          context: {
            fullName: profile?.full_name || '',
            email: profile?.email || '',
          },
        }),
      })

      if (!response.ok) throw new Error('Help chat request failed')

      const payload = await response.json()
      const reply = payload?.reply || generateReply(trimmed, profile?.role)
      setMessages((prev) => [...prev, { id: `a-${Date.now()}`, role: 'assistant', text: reply }])
    } catch {
      const reply = generateReply(trimmed, profile?.role)
      setMessages((prev) => [...prev, { id: `a-${Date.now()}`, role: 'assistant', text: reply }])
    } finally {
      setSending(false)
    }
  }

  if (location.pathname.startsWith('/client/messages')) return null

  return (
    <div className="fixed right-4 bottom-20 md:bottom-6 z-50">
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="h-12 px-4 rounded-full bg-vc-text text-white shadow-lg hover:bg-black transition-colors flex items-center gap-2"
          aria-label="Open help chat"
        >
          <MessageCircle size={16} />
          <span className="text-sm font-medium">Help</span>
        </button>
      )}

      {open && (
        <div className="w-[340px] max-w-[calc(100vw-2rem)] h-[460px] bg-white border border-vc-border shadow-2xl rounded-lg flex flex-col overflow-hidden">
          <div className="bg-vc-sidebar text-white px-3 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bot size={15} className="text-gold" />
              <div>
                <p className="text-sm font-medium">VirtueCore Assistant</p>
                <p className="text-[11px] text-white/60">Online</p>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-white/70 hover:text-white"
              aria-label="Minimize help chat"
            >
              <X size={15} />
            </button>
          </div>

          <div className="p-3 border-b border-vc-border flex flex-wrap gap-1.5 bg-vc-secondary">
            {quickPrompts.map((prompt) => (
              <button
                key={prompt}
                onClick={() => pushUserAndReply(prompt)}
                className="text-[11px] px-2 py-1 border border-vc-border rounded bg-white text-vc-muted hover:text-vc-text hover:border-vc-text transition-colors"
              >
                {prompt}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-white">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`max-w-[88%] text-sm px-3 py-2 rounded-lg ${
                  message.role === 'assistant'
                    ? 'bg-vc-secondary text-vc-text'
                    : 'ml-auto bg-vc-text text-white'
                }`}
              >
                {message.text}
              </div>
            ))}
            {sending && (
              <div className="max-w-[88%] text-sm px-3 py-2 rounded-lg bg-vc-secondary text-vc-muted">
                Typing...
              </div>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault()
              pushUserAndReply(input)
            }}
            className="p-2 border-t border-vc-border flex items-center gap-2"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask for help..."
              className="flex-1 border border-vc-border rounded px-3 py-2 text-sm text-vc-text focus:outline-none focus:border-gold"
            />
            <button
              type="submit"
              disabled={!input.trim() || sending}
              className="h-9 w-9 rounded bg-gold text-white flex items-center justify-center disabled:opacity-50"
              aria-label="Send message"
            >
              <Send size={14} />
            </button>
          </form>
        </div>
      )}
    </div>
  )
}