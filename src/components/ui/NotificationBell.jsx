import { useState, useRef, useEffect } from 'react'
import { Bell } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'

// ── Demo notifications ────────────────────────────────────────────────────────
const DEMO_NOTIFICATIONS = [
  {
    id: 'n-001',
    type: 'deliverable_review',
    title: 'Deliverable ready for review',
    body: 'February Performance Report is pending your approval.',
    read: false,
    created_at: new Date(Date.now() - 1000 * 60 * 35).toISOString(), // 35 min ago
  },
  {
    id: 'n-002',
    type: 'message',
    title: 'New message from VirtueCore',
    body: 'Your March ad creatives are in review. Should be with you by EOD Wednesday.',
    read: false,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(), // 3 h ago
  },
  {
    id: 'n-003',
    type: 'invoice_due',
    title: 'Invoice due in 5 days',
    body: 'April retainer invoice of £2,500 is due on 1 April 2026.',
    read: true,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), // 1 day ago
  },
  {
    id: 'n-smart-001',
    type: 'smart',
    title: 'CPL improved 16% this week 📉',
    body: 'Cost per lead dropped from £138 to £116 — your campaigns are getting more efficient.',
    read: false,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
  },
  {
    id: 'n-smart-002',
    type: 'smart',
    title: 'Lead volume up 29% this week 🚀',
    body: '18 leads this week vs 14 last week — your best performance yet.',
    read: false,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
  },
]

const TYPE_ICON_COLOR = {
  deliverable_review: 'bg-status-warning/10 text-status-warning',
  deliverable_approved: 'bg-status-success/10 text-status-success',
  message: 'bg-status-info/10 text-status-info',
  invoice_due: 'bg-status-danger/10 text-red-700',
  smart: 'bg-status-info/10 text-status-info',
}

export default function NotificationBell() {
  const { profile, isDemo } = useAuth()
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const dropdownRef = useRef(null)

  // Load notifications
  useEffect(() => {
    if (isDemo) {
      setNotifications(DEMO_NOTIFICATIONS)
      return
    }
    if (!profile?.id) return

    async function load() {
      const { data } = await supabase
        .from('notifications')
        .select('id, user_id, type, title, body, read, created_at')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(20)
      if (data) setNotifications(data)
    }
    load()
  }, [profile?.id])

  // Close on outside click
  useEffect(() => {
    function handleClick(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const unreadCount = notifications.filter((n) => !n.read).length

  async function markAllRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))

    if (!isDemo && profile?.id) {
      await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', profile.id)
        .eq('read', false)
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative p-2 text-white/60 hover:text-white transition-colors"
        aria-label="Notifications"
      >
        <Bell size={16} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-status-danger/100 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-bg-elevated border border-white/[0.08] shadow-md z-50">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
            <span className="text-sm font-medium text-text-primary">Notifications</span>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs text-text-secondary hover:text-text-primary transition-colors"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-white/[0.06]">
            {notifications.length === 0 ? (
              <p className="px-4 py-6 text-sm text-text-secondary text-center">
                No notifications
              </p>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={`px-4 py-3 ${n.read ? '' : 'bg-status-warning/10/40'}`}
                >
                  <div className="flex items-start gap-2.5">
                    <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${n.read ? 'bg-vc-border' : 'bg-vc-primary'}`} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-medium ${n.read ? 'text-text-secondary' : 'text-text-primary'}`}>
                        {n.title}
                      </p>
                      {n.body && (
                        <p className="text-xs text-text-secondary mt-0.5 line-clamp-2">{n.body}</p>
                      )}
                      <p className="text-xs text-text-secondary/70 mt-1">
                        {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
