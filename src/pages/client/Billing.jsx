import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { apiFetch } from '../../lib/api'

function formatDateTime(iso) {
  if (!iso) return 'Not checked yet'
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(amount || 0)
}

export default function Billing() {
  const { profile } = useAuth()
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)
  const [savingCard, setSavingCard] = useState(false)
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
    savedCard: null,
    nextBillingDate: null,
    monthlyRetainer: 0,
    revenueSharePercentage: 0,
    metaConnected: false,
    lastCheckedAt: null,
  })

  const statusPillClass = useMemo(() => {
    return status.connected
      ? 'text-xs font-medium text-status-success bg-status-success/10 px-2 py-1 rounded'
      : 'text-xs font-medium text-[#4338ca] bg-[#e0e7ff] px-2 py-1 rounded'
  }, [status.connected])

  // Detect query params after redirects
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('connected') === 'true') {
      setSuccessMessage('Stripe account connected — sync revenue to get started.')
      window.history.replaceState({}, '', window.location.pathname)
    }
    if (params.get('card_added') === 'true') {
      setSuccessMessage('Card saved successfully — your future invoices will be charged automatically.')
      window.history.replaceState({}, '', window.location.pathname)
    }
    const oauthErr = params.get('error')
    if (oauthErr) {
      setError(`Stripe error: ${oauthErr}`)
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
      if (!response.ok) throw new Error(data.error || 'Could not load status')
      setStatus({
        connected: Boolean(data?.stripeAccountId),
        stripeAccountId: data?.stripeAccountId || null,
        clientId: data?.clientId || null,
        companyName: data?.companyName || null,
        connectedAt: data?.connectedAt || null,
        totalRevenue: Number(data?.totalRevenue || 0),
        revenueSyncedAt: data?.revenueSyncedAt || null,
        savedCard: data?.savedCard || null,
        nextBillingDate: data?.nextBillingDate || null,
        monthlyRetainer: Number(data?.monthlyRetainer || 0),
        revenueSharePercentage: Number(data?.revenueSharePercentage || 0),
        metaConnected: Boolean(data?.metaConnected),
        lastCheckedAt: new Date().toISOString(),
      })
    } catch (err) {
      setError(err.message || 'Status check failed')
    } finally {
      setLoading(false)
    }
  }

  async function connectStripe() {
    setConnecting(true)
    setError('')
    try {
      const accessToken = await getAccessToken()
      const response = await fetch('/api/stripe/client-connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Stripe connect failed')
      if (payload.connectUrl) window.location.assign(payload.connectUrl)
    } catch (err) {
      setError(err.message || 'Stripe connect failed')
      setConnecting(false)
    }
  }

  async function saveCard() {
    setSavingCard(true)
    setError('')
    try {
      const res = await apiFetch('/api/stripe/setup-payment-method', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Card setup failed')
      window.location.assign(data.url)
    } catch (err) {
      setError(err.message || 'Card setup failed')
      setSavingCard(false)
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

  useEffect(() => {
    refreshStatus()
  }, [profile?.id, profile?.client_id, profile?.email])

  // Estimate next bill amount
  const estimatedCommission = Math.round(status.totalRevenue * status.revenueSharePercentage / 100) || 0
  const estimatedNextBill = estimatedCommission + status.monthlyRetainer

  return (
    <div className="p-4 md:p-6 space-y-5 w-full overflow-x-hidden">
      <div>
        <h1 className="text-h2 font-heading text-text-primary">Billing & Revenue</h1>
        <p className="text-sm text-text-secondary mt-0.5">
          Manage your Stripe connection, payment method, and billing cycle.
        </p>
      </div>

      {successMessage && (
        <div className="border border-status-success/20 bg-status-success/10 text-sm text-status-success px-4 py-3 rounded">
          {successMessage}
        </div>
      )}
      {error && (
        <div className="border border-status-danger/20 bg-status-danger/10 text-sm text-status-danger px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Card section */}
      <div className="vc-card">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h2 className="text-sm font-semibold text-text-primary mb-1">Payment Method</h2>
            {status.savedCard ? (
              <div>
                <p className="text-base text-text-primary capitalize">
                  {status.savedCard.brand} ending in {status.savedCard.last4}
                </p>
                <p className="text-xs text-text-secondary mt-1">
                  Expires {String(status.savedCard.exp_month).padStart(2, '0')}/{status.savedCard.exp_year}
                </p>
              </div>
            ) : (
              <p className="text-sm text-text-secondary">No card on file</p>
            )}
          </div>
          <button
            onClick={saveCard}
            disabled={savingCard || loading}
            className="text-xs px-3 py-2 bg-vc-primary text-white hover:bg-vc-accent rounded transition-colors disabled:opacity-60 flex-shrink-0"
          >
            {savingCard ? 'Redirecting...' : status.savedCard ? 'Update card' : 'Add card'}
          </button>
        </div>
      </div>

      {/* Stripe Connect section */}
      <div className="vc-card">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h2 className="text-sm font-semibold text-text-primary mb-1">Stripe Revenue Connection</h2>
            <p className="text-xs text-text-secondary mb-2">
              Read-only access so we can track the revenue we help you generate.
            </p>
            <span className={statusPillClass}>
              {status.connected ? 'Connected' : 'Not connected'}
            </span>
            {status.connected && status.connectedAt && (
              <p className="text-xs text-text-secondary mt-2">
                Connected on {formatDateTime(status.connectedAt)}
              </p>
            )}
          </div>
          {!status.connected ? (
            <button
              onClick={connectStripe}
              disabled={connecting || loading}
              className="text-xs px-3 py-2 bg-vc-primary text-white hover:bg-vc-accent rounded transition-colors disabled:opacity-60 flex-shrink-0"
            >
              {connecting ? 'Redirecting...' : 'Connect Stripe'}
            </button>
          ) : (
            <button
              onClick={syncRevenue}
              disabled={syncing || loading}
              className="text-xs px-3 py-2 border border-vc-primary text-vc-primary hover:bg-vc-primary/10 rounded transition-colors disabled:opacity-60 flex-shrink-0"
            >
              {syncing ? 'Syncing...' : 'Sync now'}
            </button>
          )}
        </div>
      </div>

      {/* Billing summary card */}
      {status.connected && status.savedCard && (
        <div className="border border-vc-primary/20 bg-vc-primary/5 rounded-card p-5">
          <h2 className="text-sm font-semibold text-text-primary mb-4">Your billing cycle</h2>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <p className="text-xs text-text-secondary">Cycle frequency</p>
              <p className="text-base font-medium text-text-primary mt-1">Every 28 days</p>
            </div>
            <div>
              <p className="text-xs text-text-secondary">Next bill date</p>
              <p className="text-base font-medium text-text-primary mt-1">{formatDate(status.nextBillingDate)}</p>
            </div>
            <div>
              <p className="text-xs text-text-secondary">Monthly retainer</p>
              <p className="text-base font-medium text-text-primary mt-1">{formatCurrency(status.monthlyRetainer)}</p>
            </div>
            <div>
              <p className="text-xs text-text-secondary">Revenue share</p>
              <p className="text-base font-medium text-text-primary mt-1">{status.revenueSharePercentage}%</p>
            </div>
          </div>

          <div className="border-t border-white/[0.06] pt-4">
            <p className="text-xs text-text-secondary mb-2">Estimated next bill (based on revenue tracked so far)</p>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between text-text-secondary">
                <span>Revenue tracked from Stripe</span>
                <span>{formatCurrency(status.totalRevenue)}</span>
              </div>
              <div className="flex justify-between text-text-secondary">
                <span>Commission ({status.revenueSharePercentage}%)</span>
                <span>{formatCurrency(estimatedCommission)}</span>
              </div>
              <div className="flex justify-between text-text-secondary">
                <span>Monthly retainer</span>
                <span>{formatCurrency(status.monthlyRetainer)}</span>
              </div>
              <div className="flex justify-between text-text-primary font-semibold border-t border-white/[0.06] pt-2 mt-2">
                <span>Estimated total</span>
                <span>{formatCurrency(estimatedNextBill)}</span>
              </div>
            </div>
            <p className="text-xs text-text-tertiary mt-3">
              On your billing date we'll charge your saved card automatically based on the revenue you actually generated in the prior 28 days. You'll receive a receipt with the full breakdown.
            </p>
          </div>
        </div>
      )}

      {/* How it works */}
      <div className="vc-card">
        <h2 className="text-sm font-medium text-text-primary mb-2">How automated billing works</h2>
        <ol className="text-sm text-text-secondary space-y-2 list-decimal list-inside">
          <li>We read your Stripe revenue (read-only) for the last 28 days, net of refunds.</li>
          <li>We calculate: <span className="text-text-primary">(revenue × {status.revenueSharePercentage}%) + {formatCurrency(status.monthlyRetainer)} retainer</span></li>
          <li>We charge your saved card automatically on your billing date.</li>
          <li>You receive a receipt email with a full breakdown of every charge.</li>
        </ol>
      </div>
    </div>
  )
}
