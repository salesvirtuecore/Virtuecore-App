import { useEffect, useState } from 'react'
import { Video, Calendar, Clock, ExternalLink, CheckCircle, XCircle } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'

const CALENDLY_URL = import.meta.env.VITE_CALENDLY_URL || ''

function formatDateTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) +
    ' at ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function useCalendlyScript(url) {
  useEffect(() => {
    if (!url) return
    if (document.getElementById('calendly-widget-script')) return
    const script = document.createElement('script')
    script.id = 'calendly-widget-script'
    script.src = 'https://assets.calendly.com/assets/external/widget.js'
    script.async = true
    document.head.appendChild(script)
    return () => {
      const existing = document.getElementById('calendly-widget-script')
      if (existing) existing.remove()
    }
  }, [url])
}

export default function Meetings() {
  const { profile, isDemo } = useAuth()
  const [meetings, setMeetings] = useState([])
  const [loading, setLoading] = useState(!isDemo)

  // Build pre-fill query string so Calendly fills name/email automatically
  const calendlyUrl = CALENDLY_URL
    ? `${CALENDLY_URL}?name=${encodeURIComponent(profile?.full_name || '')}&email=${encodeURIComponent(profile?.email || '')}&hide_gdpr_banner=1`
    : ''

  useCalendlyScript(calendlyUrl)

  useEffect(() => {
    if (isDemo || !supabase || !profile?.client_id) {
      setLoading(false)
      return
    }

    async function loadMeetings() {
      setLoading(true)
      const { data, error } = await supabase
        .from('meetings')
        .select('*')
        .eq('client_id', profile.client_id)
        .order('start_time', { ascending: true })

      if (!error) setMeetings(data || [])
      setLoading(false)
    }

    loadMeetings()

    // Realtime — update list instantly when a new booking comes in via webhook
    const channel = supabase
      .channel('client-meetings-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'meetings', filter: `client_id=eq.${profile.client_id}` },
        () => loadMeetings()
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [profile?.client_id])

  const upcoming = meetings.filter((m) => m.status === 'active' && new Date(m.start_time) >= new Date())
  const past = meetings.filter((m) => m.status === 'active' && new Date(m.start_time) < new Date())
  const canceled = meetings.filter((m) => m.status === 'canceled')

  return (
    <div className="p-4 md:p-6 space-y-6 w-full overflow-x-hidden">
      <div>
        <h1 className="text-h2 font-heading text-text-primary">Meetings</h1>
        <p className="text-sm text-text-secondary mt-0.5">Book a call and view your scheduled sessions</p>
      </div>

      {/* Upcoming meetings */}
      {!loading && upcoming.length > 0 && (
        <div className="border border-white/[0.06]">
          <div className="px-5 py-3 border-b border-white/[0.06] flex items-center gap-2">
            <CheckCircle size={14} className="text-status-success" />
            <h2 className="text-sm font-medium text-text-primary">Upcoming</h2>
            <span className="ml-auto text-xs bg-status-success/10 text-status-success px-2 py-0.5 rounded-full">{upcoming.length} booked</span>
          </div>
          <div className="divide-y divide-white/[0.06]">
            {upcoming.map((m) => (
              <div key={m.id} className="px-4 py-4 flex items-start justify-between gap-4 hover:bg-bg-tertiary transition-colors">
                <div>
                  <p className="text-sm font-medium text-text-primary">{m.event_type_name || 'Meeting'}</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <Clock size={12} className="text-vc-accent" />
                    <p className="text-xs text-text-secondary">{formatDateTime(m.start_time)}</p>
                  </div>
                </div>
                {m.join_url && (
                  <a
                    href={m.join_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-shrink-0 text-xs px-3 py-1.5 bg-vc-primary text-white rounded hover:bg-vc-accent transition-colors flex items-center gap-1"
                  >
                    <ExternalLink size={11} />
                    Join
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Calendly inline embed */}
      <div className="border border-white/[0.06]">
        <div className="px-5 py-3 border-b border-white/[0.06] flex items-center gap-2">
          <Calendar size={14} className="text-vc-accent" />
          <h2 className="text-sm font-medium text-text-primary">Book a Call</h2>
        </div>

        {calendlyUrl ? (
          <div
            className="calendly-inline-widget w-full"
            data-url={calendlyUrl}
            style={{ height: '700px' }}
          />
        ) : (
          <div className="bg-bg-tertiary h-48 flex items-center justify-center">
            <div className="text-center px-6">
              <Calendar size={28} className="text-text-secondary mx-auto mb-2" />
              <p className="text-sm font-medium text-text-primary">Calendar not yet configured</p>
              <p className="text-xs text-text-secondary mt-1">Add <code className="bg-bg-tertiary px-1">VITE_CALENDLY_URL</code> to your Vercel environment variables to enable booking.</p>
            </div>
          </div>
        )}
      </div>

      {/* Past meetings */}
      {past.length > 0 && (
        <div className="border border-white/[0.06]">
          <div className="px-5 py-3 border-b border-white/[0.06] flex items-center gap-2">
            <Video size={14} className="text-text-secondary" />
            <h2 className="text-sm font-medium text-text-primary">Past Meetings</h2>
          </div>
          <div className="divide-y divide-white/[0.06]">
            {past.map((m) => (
              <div key={m.id} className="px-5 py-3 flex items-center justify-between hover:bg-bg-tertiary transition-colors">
                <div>
                  <p className="text-sm font-medium text-text-primary">{m.event_type_name || 'Meeting'}</p>
                  <p className="text-xs text-text-secondary mt-0.5">{formatDateTime(m.start_time)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Canceled */}
      {canceled.length > 0 && (
        <div className="border border-white/[0.06] opacity-60">
          <div className="px-5 py-3 border-b border-white/[0.06] flex items-center gap-2">
            <XCircle size={14} className="text-text-secondary" />
            <h2 className="text-sm font-medium text-text-secondary">Canceled</h2>
          </div>
          <div className="divide-y divide-white/[0.06]">
            {canceled.map((m) => (
              <div key={m.id} className="px-5 py-3">
                <p className="text-sm text-text-secondary line-through">{m.event_type_name || 'Meeting'}</p>
                <p className="text-xs text-text-secondary mt-0.5">{formatDateTime(m.start_time)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state when no meetings yet */}
      {!loading && meetings.length === 0 && (
        <p className="text-xs text-text-secondary text-center py-4">
          No meetings booked yet — use the calendar above to schedule a call.
        </p>
      )}
    </div>
  )
}
