import { useState, useEffect, useRef } from 'react'
import { Send } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { supabase, isDemoMode } from '../../lib/supabase'
import { DEMO_MESSAGES } from '../../data/placeholder'
import { sendPushNotification } from '../../lib/pushNotifications'

export default function Messages() {
  const { profile } = useAuth()
  const [messages, setMessages] = useState(isDemoMode ? DEMO_MESSAGES : [])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState('')
  const [adminUserIds, setAdminUserIds] = useState([])
  const bottomRef = useRef(null)

  const clientId = profile?.client_id

  // Load messages + fetch admin user IDs for push
  useEffect(() => {
    if (isDemoMode || !supabase || !clientId) return

    supabase
      .from('crm_messages')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        if (data) setMessages(data)
      })

    supabase
      .from('profiles')
      .select('id')
      .eq('role', 'admin')
      .then(({ data }) => {
        if (data) setAdminUserIds(data.map((p) => p.id))
      })
  }, [clientId])

  // Realtime subscription
  useEffect(() => {
    if (isDemoMode || !supabase || !clientId) return

    const channel = supabase
      .channel(`client-messages-${clientId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `client_id=eq.${clientId}` },
        (payload) => {
          setMessages((prev) => {
            if (prev.some((m) => m.id === payload.new.id)) return prev
            // Attach sender info for display (realtime payloads don't include joins)
            const newMsg = {
              ...payload.new,
              sender: payload.new.sender_id === profile?.id
                ? { full_name: profile?.full_name, role: 'client' }
                : null,
            }
            return [...prev, newMsg]
          })
        }
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [clientId])

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function send() {
    if (!input.trim() || sending) return

    const content = input.trim()
    setInput('')

    if (isDemoMode) {
      setMessages((prev) => [
        ...prev,
        {
          id: `m-${Date.now()}`,
          client_id: clientId ?? 'c-001',
          sender_id: profile?.id ?? 'client-001',
          sender_name: profile?.full_name ?? 'You',
          sender_role: 'client',
          content,
          created_at: new Date().toISOString(),
        },
      ])
      return
    }

    setSendError('')
    setSending(true)
    try {
      const { data, error } = await supabase
        .from('crm_messages')
        .insert({
          client_id: clientId,
          sender_id: profile?.id,
          sender_name: profile?.full_name ?? null,
          sender_role: 'client',
          content,
        })
        .select()
        .single()

      if (error) throw error
      const enriched = { ...data, sender: { full_name: profile?.full_name, role: 'client' } }
      setMessages((prev) => (prev.some((m) => m.id === enriched.id) ? prev : [...prev, enriched]))

      // Notify all admins
      for (const adminId of adminUserIds) {
        sendPushNotification(adminId, {
          title: `Message from ${profile?.full_name ?? 'Client'}`,
          body: content.slice(0, 100),
          url: `/admin/clients/${clientId}`,
        })
      }
    } catch (err) {
      console.error('Failed to send message', err)
      setSendError(err?.message || 'Failed to send. Please try again.')
      setInput(content)
    } finally {
      setSending(false)
    }
  }

  function formatTime(iso) {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    })
  }

  return (
    <div className="p-4 md:p-6 flex flex-col h-full min-h-0">
      <div className="mb-4">
        <h1 className="text-xl font-semibold text-vc-text">Messages</h1>
        <p className="text-sm text-vc-muted mt-0.5">Your VirtueCore team</p>
      </div>

      {sendError && (
        <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 text-xs text-red-700">
          {sendError}
        </div>
      )}

      {!isDemoMode && !clientId && !sending && (
        <div className="mb-3 px-3 py-2 bg-amber-50 border border-amber-200 text-xs text-amber-800">
          Account not linked yet — try refreshing the page.
        </div>
      )}

      <div className="flex-1 border border-vc-border flex flex-col min-h-0">
        {/* Thread */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <p className="text-sm text-vc-muted text-center py-8">No messages yet. Say hi!</p>
          )}
          {messages.map((msg) => {
            const isMe = msg.sender_id === profile?.id
            const senderName = msg.sender?.full_name ?? msg.sender_name ?? (isMe ? (profile?.full_name ?? 'You') : 'VirtueCore')
            return (
              <div key={msg.id} className={`flex gap-3 ${isMe ? 'flex-row-reverse' : ''}`}>
                <div
                  className={`w-7 h-7 flex-shrink-0 flex items-center justify-center text-xs font-bold ${
                    isMe ? 'bg-vc-secondary text-vc-muted' : 'bg-gold text-white'
                  }`}
                >
                  {senderName[0]}
                </div>
                <div className={`max-w-[75%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium text-vc-text">{senderName}</span>
                    <span className="text-xs text-vc-muted">{formatTime(msg.created_at)}</span>
                  </div>
                  <div
                    className={`px-3 py-2 text-sm ${
                      isMe
                        ? 'bg-vc-text text-white'
                        : 'bg-vc-secondary text-vc-text border border-vc-border'
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              </div>
            )
          })}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="border-t border-vc-border p-3 flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && send()}
            placeholder="Type a message..."
            className="flex-1 border border-vc-border px-3 py-2 text-sm focus:outline-none focus:border-vc-text"
            disabled={sending}
          />
          <button
            onClick={send}
            disabled={sending || !input.trim()}
            className="px-3 py-2 bg-vc-text text-white hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            <Send size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}
