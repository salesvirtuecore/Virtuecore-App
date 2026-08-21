import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { useToast } from '../../context/ToastContext'
import { supabase } from '../../lib/supabase'
import { apiFetch } from '../../lib/api'

export default function MetaMatching() {
  const { showToast } = useToast()
  const [queue, setQueue] = useState([])
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [matching, setMatching] = useState(false)
  const [picks, setPicks] = useState({})

  async function loadQueue() {
    setLoading(true)
    try {
      const [queueRes, clientsData] = await Promise.all([
        apiFetch('/api/meta/list-queue'),
        supabase.from('clients').select('id, company_name').order('company_name'),
      ])
      const queueData = await queueRes.json()
      if (queueRes.ok) setQueue(queueData.queue || [])
      if (clientsData.data) setClients(clientsData.data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadQueue()
  }, [])

  async function runMatching() {
    setMatching(true)
    try {
      const res = await apiFetch('/api/meta/match-accounts', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Matching failed')
      showToast(`${data.exact_matches} matched automatically, ${data.queued} need review`)
      loadQueue()
    } catch (err) {
      showToast(err.message || 'Matching failed', 'error')
    } finally {
      setMatching(false)
    }
  }

  async function confirmMatch(queueId) {
    const clientId = picks[queueId]
    if (!clientId) return showToast('Pick a client first', 'error')
    try {
      const res = await apiFetch('/api/meta/confirm-match', {
        method: 'POST',
        body: JSON.stringify({ queue_id: queueId, client_id: clientId }),
      })
      if (!res.ok) throw new Error('Failed to confirm')
      showToast('Match confirmed')
      loadQueue()
    } catch (err) {
      showToast(err.message || 'Failed to confirm', 'error')
    }
  }

  async function rejectMatch(queueId) {
    try {
      const res = await apiFetch('/api/meta/reject-match', {
        method: 'POST',
        body: JSON.stringify({ queue_id: queueId }),
      })
      if (!res.ok) throw new Error('Failed to reject')
      loadQueue()
    } catch (err) {
      showToast(err.message || 'Failed to reject', 'error')
    }
  }

  return (
    <div className="p-4 md:p-6 space-y-5 w-full overflow-x-hidden">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-h2 font-heading text-text-primary">Meta Account Matching</h1>
          <p className="text-sm text-text-secondary mt-0.5">Match Meta ad accounts (from your Business Manager) to clients — no per-client OAuth needed.</p>
        </div>
        <button
          onClick={runMatching}
          disabled={matching}
          className="text-xs px-4 py-2 bg-vc-primary text-white hover:bg-vc-accent rounded transition-colors disabled:opacity-60 flex items-center gap-1.5"
        >
          <RefreshCw size={12} className={matching ? 'animate-spin' : ''} />
          {matching ? 'Matching...' : 'Run matching'}
        </button>
      </div>

      <div className="vc-card">
        <h2 className="text-sm font-semibold text-text-primary mb-3">Needs review ({queue.length})</h2>
        {loading ? (
          <p className="text-sm text-text-secondary">Loading...</p>
        ) : queue.length === 0 ? (
          <p className="text-sm text-text-secondary">Nothing pending — run matching to check for new accounts.</p>
        ) : (
          <div className="space-y-3">
            {queue.map((row) => (
              <div key={row.id} className="flex flex-col sm:flex-row sm:items-center gap-3 px-3 py-3 bg-bg-tertiary rounded">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-text-primary font-medium">{row.ad_account_name || row.ad_account_id}</p>
                  <p className="text-xs text-text-secondary">Business name: {row.business_name || '—'} · {row.ad_account_id}</p>
                  {row.match_type === 'ai_suggested' && (
                    <p className="text-xs text-vc-accent mt-0.5">AI suggests: {row.suggested_client_name} ({Math.round((row.confidence_score || 0) * 100)}% confidence)</p>
                  )}
                </div>
                <select
                  value={picks[row.id] || row.suggested_client_id || ''}
                  onChange={(e) => setPicks((prev) => ({ ...prev, [row.id]: e.target.value }))}
                  className="text-xs bg-bg-secondary border border-white/[0.08] rounded px-2 py-1.5 text-text-primary"
                >
                  <option value="">Pick a client...</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>{c.company_name}</option>
                  ))}
                </select>
                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={() => confirmMatch(row.id)} className="text-xs px-3 py-1.5 bg-vc-primary text-white hover:bg-vc-accent rounded transition-colors">
                    Confirm
                  </button>
                  <button onClick={() => rejectMatch(row.id)} className="text-xs px-3 py-1.5 border border-white/[0.08] text-text-secondary hover:text-text-primary rounded transition-colors">
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
