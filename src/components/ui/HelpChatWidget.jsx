import { useMemo, useRef, useState } from 'react'
import { Bot, MessageCircle, Send, X, Image as ImageIcon } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useLocation } from 'react-router-dom'
import { apiFetch } from '../../lib/api'

// Capped well under Vercel's ~4.5MB serverless request-body limit — base64
// inflates the raw file by ~33%, so a 5MB image would already blow past
// that limit on its own before the rest of the JSON payload is even added.
const MAX_IMAGE_BYTES = 3 * 1024 * 1024
const SUPPORTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp'])

// Small dependency-free renderer for the markdown constructs the assistant
// actually produces — bold, inline code, headings, horizontal rules, bullet
// lists (including a label line immediately followed by bullets, which a
// naive "whole block must be a list" check misses), and paragraphs with
// line breaks. A full markdown library is overkill for a chat bubble, but
// plain text left every one of these showing up as literal characters.
function renderInline(text, keyPrefix) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return <strong key={`${keyPrefix}-${i}`}>{part.slice(2, -2)}</strong>
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return <code key={`${keyPrefix}-${i}`} className="px-1 py-0.5 rounded bg-black/10 font-mono text-[0.85em]">{part.slice(1, -1)}</code>
    }
    return part ? <span key={`${keyPrefix}-${i}`}>{part}</span> : null
  })
}

function renderMarkdownLite(text) {
  if (!text) return null
  const lines = text.split('\n')
  const nodes = []
  let paragraphBuffer = []
  let listBuffer = []

  function flushParagraph() {
    if (paragraphBuffer.length === 0) return
    const buf = paragraphBuffer
    nodes.push(
      <p key={nodes.length} className={nodes.length > 0 ? 'mt-2' : ''}>
        {buf.map((line, li) => (
          <span key={li}>
            {renderInline(line, `p-${nodes.length}-${li}`)}
            {li < buf.length - 1 && <br />}
          </span>
        ))}
      </p>
    )
    paragraphBuffer = []
  }
  function flushList() {
    if (listBuffer.length === 0) return
    const buf = listBuffer
    nodes.push(
      <ul key={nodes.length} className={`list-disc list-inside space-y-0.5 ${nodes.length > 0 ? 'mt-2' : ''}`}>
        {buf.map((line, li) => (
          <li key={li}>{renderInline(line, `l-${nodes.length}-${li}`)}</li>
        ))}
      </ul>
    )
    listBuffer = []
  }

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) { flushParagraph(); flushList(); continue }
    if (/^-{3,}$/.test(line)) {
      flushParagraph(); flushList()
      nodes.push(<hr key={nodes.length} className="my-2 border-white/10" />)
      continue
    }
    const heading = line.match(/^(#{1,3})\s+(.*)$/)
    if (heading) {
      flushParagraph(); flushList()
      const level = heading[1].length
      const sizeClass = level === 1 ? 'text-sm font-bold' : level === 2 ? 'text-sm font-semibold' : 'text-xs font-semibold'
      nodes.push(<p key={nodes.length} className={`${sizeClass} ${nodes.length > 0 ? 'mt-2' : ''}`}>{renderInline(heading[2], `h-${nodes.length}`)}</p>)
      continue
    }
    const bullet = line.match(/^[-*•]\s+(.*)$/)
    if (bullet) {
      flushParagraph()
      listBuffer.push(bullet[1])
      continue
    }
    flushList()
    paragraphBuffer.push(line)
  }
  flushParagraph()
  flushList()
  return nodes
}

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
  const [pendingImage, setPendingImage] = useState(null) // { dataUrl, mediaType, base64 }
  const [imageError, setImageError] = useState('')
  const fileInputRef = useRef(null)
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

  function handleImageSelect(e) {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-selecting the same file later
    if (!file) return
    setImageError('')
    if (!SUPPORTED_IMAGE_TYPES.has(file.type)) {
      setImageError('Please upload a JPEG, PNG, GIF, or WEBP image.')
      return
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setImageError('Image is too large (max 3MB).')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result
      const base64 = String(dataUrl).split(',')[1] || ''
      setPendingImage({ dataUrl, mediaType: file.type, base64 })
    }
    reader.onerror = () => setImageError('Could not read that image — try again.')
    reader.readAsDataURL(file)
  }

  async function pushUserAndReply(text) {
    const trimmed = text.trim()
    const image = pendingImage
    if ((!trimmed && !image) || sending) return

    const userMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      text: trimmed || 'What do you make of this?',
      imageDataUrl: image?.dataUrl || null,
    }
    const historySnapshot = [...messages, userMessage]
    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setPendingImage(null)
    setSending(true)

    try {
      const response = await apiFetch('/api/admin/help-chat', {
        method: 'POST',
        body: JSON.stringify({
          message: userMessage.text,
          messages: historySnapshot.map((m) => ({ role: m.role, text: m.text })),
          role: profile?.role || 'client',
          page: location.pathname,
          context: {
            fullName: profile?.full_name || '',
            email: profile?.email || '',
          },
          image: image ? { media_type: image.mediaType, data: image.base64 } : undefined,
        }),
      })

      if (!response.ok) throw new Error('Help chat request failed')

      const payload = await response.json()
      const reply = payload?.reply || generateReply(userMessage.text, profile?.role)
      setMessages((prev) => [...prev, { id: `a-${Date.now()}`, role: 'assistant', text: reply }])
    } catch {
      const reply = generateReply(userMessage.text, profile?.role)
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
          className="h-12 px-4 rounded-full bg-vc-primary text-white shadow-lg hover:bg-black transition-colors flex items-center gap-2"
          aria-label="Open help chat"
        >
          <MessageCircle size={16} />
          <span className="text-sm font-medium">Help</span>
        </button>
      )}

      {open && (
        <div className="w-[340px] max-w-[calc(100vw-2rem)] h-[460px] bg-bg-elevated border border-white/[0.08] shadow-2xl rounded-lg flex flex-col overflow-hidden">
          <div className="bg-vc-sidebar text-white px-3 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bot size={15} className="text-vc-accent" />
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

          <div className="p-3 border-b border-white/[0.06] flex flex-wrap gap-1.5 bg-bg-tertiary">
            {quickPrompts.map((prompt) => (
              <button
                key={prompt}
                onClick={() => pushUserAndReply(prompt)}
                className="text-[11px] px-2 py-1 border border-white/[0.06] rounded bg-bg-elevated text-text-secondary hover:text-text-primary hover:border-white/[0.16] transition-colors"
              >
                {prompt}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-bg-elevated">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`max-w-[88%] text-sm px-3 py-2 rounded-lg ${
                  message.role === 'assistant'
                    ? 'bg-bg-tertiary text-text-primary'
                    : 'ml-auto bg-vc-primary text-white'
                }`}
              >
                {message.imageDataUrl && (
                  <img src={message.imageDataUrl} alt="Attachment" className="max-w-full rounded mb-1.5 border border-white/20" />
                )}
                {message.role === 'assistant' ? renderMarkdownLite(message.text) : message.text}
              </div>
            ))}
            {sending && (
              <div className="max-w-[88%] text-sm px-3 py-2 rounded-lg bg-bg-tertiary text-text-secondary">
                Typing...
              </div>
            )}
          </div>

          {(pendingImage || imageError) && (
            <div className="px-2 pt-2 border-t border-white/[0.06] bg-bg-tertiary">
              {pendingImage && (
                <div className="flex items-center gap-2 mb-2">
                  <img src={pendingImage.dataUrl} alt="Selected attachment" className="h-10 w-10 object-cover rounded border border-white/[0.08]" />
                  <span className="text-xs text-text-secondary flex-1">Image attached</span>
                  <button
                    type="button"
                    onClick={() => setPendingImage(null)}
                    className="text-text-tertiary hover:text-text-primary"
                    aria-label="Remove attached image"
                  >
                    <X size={13} />
                  </button>
                </div>
              )}
              {imageError && <p className="text-xs text-status-danger mb-2">{imageError}</p>}
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault()
              pushUserAndReply(input)
            }}
            className="p-2 border-t border-white/[0.06] flex items-center gap-2"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              onChange={handleImageSelect}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="h-9 w-9 flex-shrink-0 rounded border border-white/[0.06] text-text-secondary hover:text-text-primary hover:border-white/[0.16] flex items-center justify-center transition-colors"
              aria-label="Attach an image"
            >
              <ImageIcon size={15} />
            </button>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={pendingImage ? 'Ask about this image...' : 'Ask for help...'}
              className="flex-1 border border-white/[0.06] rounded px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-vc-primary"
            />
            <button
              type="submit"
              disabled={(!input.trim() && !pendingImage) || sending}
              className="h-9 w-9 rounded bg-vc-primary text-white flex items-center justify-center disabled:opacity-50"
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