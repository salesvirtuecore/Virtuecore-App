import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { apiFetch } from '../../lib/api'

function formatDateTime(iso) {
  if (!iso) return 'Not checked yet'
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(amount || 0)
}

export default function Billing() {
  const { profile } = useAuth()
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [status, setStatus] = useState({
    connected: false,
    stripeAccountId: null,
    clientId: null,
    companyName: null,
    connectedAt: null,
    totalRevenue: 0,
    revenueSyncedAt: null,
    lastCheckedAt: null,
  })

  const statusPillClass = useMemo(() => {
    return status.connected
      ? 'text-xs font-medium text-status-success bg-status-success/10 px-2 py-1 rounded'
      : 'text-xs font-medium text-[#4338ca] bg-[#e0e7ff] px-2 py-1 rounded'
  }, [status.connected])

  // Detect OAuth redirect (?connected=true or ?error=...)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('connected') === 'true') {
      setSuccessMessage('Stripe account connected successfully — sync revenue to get started.')
      window.history.replaceState({}, '', window.location.pathname)
    }
    const oauthErr = params.get('error')
    if (oauthErr) {
      setError(`Stripe connection failed: ${oauthErr}`)
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

  async function getAccessToken() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) throw new Error('Session expired. Please sign in again.')
    return session.access_token
  }

  async function refreshStatus() {
    if (!profile?.id) return
    setLoading(true)
    setError('')
    try {
      const accessToken = await getAccessToken()
      const response = await fetch('/api/stripe/client-connect', {
        method: 'GET',
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not load Stripe status')
      setStatus({
        connected: Boolean(data?.stripeAccountId),
        stripeAccountId: data?.stripeAccountId || null,
        clientId: data?.clientId || null,
        companyName: data?.companyName || null,
        connectedAt: data?.connectedAt || null,
        totalRevenue: Number(data?.totalRevenue || 0),
        revenueSyncedAt: data?.revenueSyncedAt || null,
        lastCheckedAt: new Date().toISOString(),
      })
    } catch (err) {
      setError(err.message || 'Stripe status check failed')
    } finally {
      setLoading(false)
    }
  }

  async function connectStripe() {
    setConnecting(true)
    setError('')
    setSuccessMessage('')
    try {
      const accessToken = await getAccessToken()
      const response = await fetch('/api/stripe/client-connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Stripe connect failed')
      if (payload.connectUrl) {
        window.location.assign(payload.connectUrl)
      }
    } catch (err) {
      setError(err.message || 'Stripe connect failed')
      setConnecting(false)
    }
  }

  async function syncRevenue() {
    setSyncing(true)
    setError('')
    setSuccessMessage('')
    try {
      const response = await apiFetch('/api/stripe/sync-revenue', { method: 'POST' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Sync failed')
      setSuccessMessage(`Synced ${data.charge_count} charges — total ${formatCurrency(data.total_revenue)}`)
      await refreshStatus()
    } catch (err) {
      setError(err.message || 'Sync failed')
    } finally {
      setSyncing(false)
    }
  }

  const refreshStatusRef = useRef(refreshStatus)
  useEffect(() => { refreshStatusRef.current = refreshStatus })

  useEffect(() => {
    refreshStatus()
  }, [profile?.id, profile?.client_id, profile?.email])

  return (
    <div className="p-4 md:p-6 space-y-5 w-full overflow-x-hidden">
      <div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#635bff]">Stripe</span>
          <span className="text-xs text-[#4f46e5] bg-[#eef2ff] border border-[#c7d2fe] px-2 py-0.5 rounded">Revenue Tracking</span>
        </div>
        <h1 className="text-h2 font-heading text-text-primary mt-1">Billing & Revenue</h1>
        <p className="text-sm text-text-secondary mt-0.5">
          Connect your existing Stripe account so VirtueCore can track the revenue we've helped you generate.
        </p>
      </div>

      {/* Connection card */}
      <div className="border border-[#c7d2fe] bg-gradient-to-r from-[#eef2ff] to-[#f8f7ff] p-5 space-y-4 rounded">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-[#312e81]">Stripe Connection Status</p>
            <p className="text-xs text-[#4338ca] mt-1">Last checked: {formatDateTime(status.lastCheckedAt)}</p>
          </div>
          <span className={statusPillClass}>
            {status.connected ? 'Connected' : 'Not connected'}
          </span>
        </div>

        {status.connected && status.connectedAt && (
          <div className="text-sm text-text-primary">
            <span className="text-[#4f46e5]">Connected on:</span> {formatDateTime(status.connectedAt)}
          </div>
        )}

        {status.connected && status.stripeAccountId && (
          <div className="text-xs text-text-secondary font-mono">
            {status.stripeAccountId}
          </div>
        )}

        {successMessage && (
          <p className="text-xs text-status-success bg-status-success/10 border border-status-success/20 px-3 py-2 rounded">
            {successMessage}
          </p>
        )}
        {error && (
          <p className="text-xs text-status-danger bg-status-danger/10 border border-status-danger/20 px-3 py-2 rounded">
            {error}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          {!status.connected && (
            <button
              type="button"
              onClick={connectStripe}
              disabled={connecting || loading}
              className="text-xs px-3 py-2 bg-[#635bff] text-white hover:bg-[#4f46e5] rounded transition-colors disabled:opacity-60"
            >
              {connecting ? 'Redirecting to Stripe...' : 'Connect your Stripe account'}
            </button>
          )}
          {status.connected && (
            <button
              type="button"
              onClick={syncRevenue}
              disabled={syncing || loading}
              className="text-xs px-3 py-2 bg-[#635bff] text-white hover:bg-[#4f46e5] rounded transition-colors disabled:opacity-60"
            >
              {syncing ? 'Syncing...' : 'Sync revenue from Stripe'}
            </button>
          )}
          <button
            type="button"
            onClick={refreshStatus}
            disabled={loading}
            className="text-xs px-3 py-2 border border-[#635bff] text-[#4338ca] bg-bg-elevated hover:bg-[#eef2ff] rounded transition-colors disabled:opacity-60"
          >
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Revenue card */}
      {status.connected && (
        <div className="vc-card">
          <h2 className="text-sm font-medium text-text-secondary mb-1">Total revenue since joining VirtueCore</h2>
          <p className="text-3xl font-semibold text-text-primary mt-1">{formatCurrency(status.totalRevenue)}</p>
          <p className="text-xs text-text-secondary mt-2">
            {status.revenueSyncedAt
              ? `Last synced ${formatDateTime(status.revenueSyncedAt)}`
              : 'Not yet synced — click "Sync revenue from Stripe" to fetch your charges.'}
          </p>
        </div>
      )}

      {/* How it works */}
      <div className="vc-card">
        <h2 className="text-sm font-medium text-text-primary mb-2">How it works</h2>
        <ol className="text-sm text-text-secondary space-y-2 list-decimal list-inside">
          <li>Click "Connect your Stripe account" — you'll be redirected to Stripe to authorise read-only access.</li>
          <li>Once authorised, we can read your successful charges since you joined VirtueCore.</li>
          <li>Click "Sync revenue" any time to refresh the total. We never have access to move funds or make changes.</li>
        </ol>
      </div>
    </div>
  )
}
