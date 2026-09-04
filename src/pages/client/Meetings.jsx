import { useEffect, useState } from 'react'
import { Calendar, ExternalLink, Search } from 'lucide-react'
import Badge from '../../components/ui/Badge'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { apiFetch } from '../../lib/api'

function formatDateTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) +
    ' at ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

const STATUS_BADGE = { active: 'green', canceled: 'default' }
const STATUS_LABEL = { active: 'Booked', canceled: 'Canceled' }

export default function Meetings({ clientId } = {}) {
  const { profile } = useAuth()
  const { showToast } = useToast()
  const effectiveClientId = clientId ?? profile?.client_id
  const isAdmin = profile?.role === 'admin'
  const showAllClients = isAdmin && !effectiveClientId

  const [meetings, setMeetings] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  // Calendly connection state — not relevant in the cross-client admin view
  const [calendlyStatus, setCalendlyStatus] = useState({ connected: false, calendlyKeyMasked: null, connectedAt: null })
  const [statusLoading, setStatusLoading] = useState(!showAllClients)
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [editingKey, setEditingKey] = useState(false)
  const [savingKey, setSavingKey] = useState(false)

  useEffect(() => {
    if (!supabase || (!effectiveClientId && !showAllClients)) {
      setLoading(false)
      return
    }

    let canceled = false

    async function loadMeetings() {
      setLoading(true)
      let query = supabase
        .from('meetings')
        .select(
          showAllClients
            ? 'id, client_id, invitee_name, invitee_email, start_time, end_time, event_type_name, join_url, status, clients(company_name)'
            : 'id, client_id, invitee_name, invitee_email, start_time, end_time, event_type_name, join_url, status'
        )
        .order('start_time', { ascending: false })
      if (!showAllClients) query = query.eq('client_id', effectiveClientId)

      const { data, error } = await query
      if (!canceled) {
        if (!error) setMeetings(data || [])
        setLoading(false)
      }
    }

    loadMeetings()

    const channel = supabase
      .channel(showAllClients ? 'admin-all-bookings' : `client-bookings-${effectiveClientId}`)
      .on(
        'postgres_changes',
        showAllClients
          ? { event: '*', schema: 'public', table: 'meetings' }
          : { event: '*', schema: 'public', table: 'meetings', filter: `client_id=eq.${effectiveClientId}` },
        () => loadMeetings()
      )
      .subscribe()

    return () => {
      canceled = true
      supabase.removeChannel(channel)
    }
  }, [effectiveClientId, showAllClients])

  useEffect(() => {
    if (showAllClients || !effectiveClientId) { setStatusLoading(false); return }
    let canceled = false
    async function loadStatus() {
      setStatusLoading(true)
      try {
        const res = await apiFetch(`/api/calendly/status?client_id=${effectiveClientId}`)
        const data = await res.json()
        if (!canceled && res.ok) setCalendlyStatus(data)
      } catch {
        // leave default (not connected) — the connect card covers this case
      } finally {
        if (!canceled) setStatusLoading(false)
      }
    }
    loadStatus()
    return () => { canceled = true }
  }, [effectiveClientId, showAllClients])

  async function saveApiKey() {
    if (!apiKeyInput.trim()) {
      showToast('Paste your Calendly API key first', 'error')
      return
    }
    setSavingKey(true)
    try {
      const res = await apiFetch('/api/calendly/save-api-key', {
        method: 'POST',
        body: JSON.stringify({ api_key: apiKeyInput.trim(), client_id: effectiveClientId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not connect Calendly')
      showToast('Calendly connected — new bookings will appear here automatically')
      setApiKeyInput('')
      setEditingKey(false)
      setCalendlyStatus({ connected: true, calendlyKeyMasked: data.masked, connectedAt: new Date().toISOString() })
    } catch (err) {
      showToast(err.message || 'Could not connect Calendly', 'error')
    } finally {
      setSavingKey(false)
    }
  }

  const filtered = meetings.filter((m) => {
    const q = search.toLowerCase()
    return (
      (m.invitee_name || '').toLowerCase().includes(q) ||
      (m.invitee_email || '').toLowerCase().includes(q) ||
      (showAllClients && (m.clients?.company_name || '').toLowerCase().includes(q))
    )
  })

  const inputClass = 'flex-1 text-sm bg-bg-tertiary border border-white/[0.08] rounded px-3 py-2 text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-vc-primary'

  return (
    <div className="p-4 md:p-6 space-y-5 w-full overflow-x-hidden">
      <div>
        <h1 className="text-h2 font-heading text-text-primary">Bookings</h1>
        <p className="text-sm text-text-secondary mt-0.5">
          {showAllClients
            ? `${meetings.length} booking${meetings.length === 1 ? '' : 's'} across all clients`
            : 'Calls booked through your Calendly'}
        </p>
      </div>

      {/* Connect Calendly — per-client only, not in the cross-client admin view */}
      {!showAllClients && !statusLoading && (
        <div className="vc-card">
          <div className="flex items-start justify-between gap-4 mb-3">
            <div className="flex-1">
              <h2 className="text-sm font-semibold text-text-primary mb-1">Calendly Connection</h2>
              <p className="text-xs text-text-secondary mb-2">
                Connect your own Calendly so bookings from your customers show up here automatically. Find your API key at{' '}
                <span className="text-text-primary">calendly.com/integrations/api_webhooks</span>.
              </p>
              <Badge variant={calendlyStatus.connected ? 'green' : 'default'} dot>
                {calendlyStatus.connected ? 'Connected' : 'Not connected'}
              </Badge>
            </div>
          </div>

          {calendlyStatus.connected && !editingKey ? (
            <div className="flex items-center justify-between gap-3 bg-bg-tertiary rounded px-3 py-2">
              <span className="text-sm font-mono text-text-secondary">{calendlyStatus.calendlyKeyMasked || '••••••••'}</span>
              <button
                onClick={() => setEditingKey(true)}
                className="text-xs px-3 py-1.5 border border-white/[0.08] text-text-secondary hover:text-text-primary rounded transition-colors flex-shrink-0"
              >
                Replace key
              </button>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="password"
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder="Calendly API key"
                className={inputClass}
              />
              <div className="flex gap-2">
                <button
                  onClick={saveApiKey}
                  disabled={savingKey}
                  className="text-xs px-3 py-2 bg-vc-primary text-white hover:bg-vc-accent rounded transition-colors disabled:opacity-60 flex-shrink-0"
                >
                  {savingKey ? 'Connecting...' : 'Connect'}
                </button>
                {calendlyStatus.connected && (
                  <button
                    onClick={() => { setEditingKey(false); setApiKeyInput('') }}
                    className="text-xs px-3 py-2 text-text-secondary hover:text-text-primary rounded transition-colors flex-shrink-0"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="relative max-w-xs">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={showAllClients ? 'Search bookings or client...' : 'Search bookings...'}
          className="w-full pl-9 pr-3 py-2 text-sm bg-bg-tertiary border border-white/[0.08] rounded-btn text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-vc-primary focus:ring-1 focus:ring-vc-primary"
        />
      </div>

      <div className="vc-card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="vc-table min-w-[800px]">
            <thead>
              <tr>
                {showAllClients && <th>Client</th>}
                <th>Booked By</th>
                <th>Event</th>
                <th>Date &amp; Time</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={showAllClients ? 6 : 5} className="px-5 py-8 text-center text-sm text-text-secondary">
                    Loading bookings...
                  </td>
                </tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={showAllClients ? 6 : 5} className="px-5 py-8 text-center text-sm text-text-secondary">
                    <Calendar size={20} className="mx-auto mb-2 text-text-tertiary" />
                    No bookings yet.
                  </td>
                </tr>
              )}
              {filtered.map((m) => (
                <tr key={m.id}>
                  {showAllClients && (
                    <td className="font-medium text-text-primary">{m.clients?.company_name || '—'}</td>
                  )}
                  <td>
                    <p className="font-medium text-text-primary">{m.invitee_name || 'Unknown'}</p>
                    <p className="text-xs text-text-tertiary">{m.invitee_email}</p>
                  </td>
                  <td className="text-text-secondary">{m.event_type_name || 'Meeting'}</td>
                  <td className="text-text-secondary">{formatDateTime(m.start_time)}</td>
                  <td><Badge variant={STATUS_BADGE[m.status] ?? 'default'}>{STATUS_LABEL[m.status] ?? m.status}</Badge></td>
                  <td>
                    {m.join_url && (
                      <a
                        href={m.join_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-vc-accent hover:text-vc-primary transition-colors"
                      >
                        <ExternalLink size={11} />
                        Join
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
