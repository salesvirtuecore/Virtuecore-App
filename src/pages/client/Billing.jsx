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
  const [savingKey, setSavingKey] = useState(false)
  const [editingKey, setEditingKey] = useState(false)
  const [secretKeyInput, setSecretKeyInput] = useState('')
  const [savingCard, setSavingCard] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [status, setStatus] = useState({
    connected: false,
    stripeAccountId: null,
    stripeKeyValid: false,
    stripeKeyMasked: null,
    stripeKeyAddedAt: null,
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
        connected: Boolean(data?.stripeAccountId || data?.stripeKeyValid),
        stripeAccountId: data?.stripeAccountId || null,
        stripeKeyValid: Boolean(data?.stripeKeyValid),
        stripeKeyMasked: data?.stripeKeyMasked || null,
        stripeKeyAddedAt: data?.stripeKeyAddedAt || null,
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

  async function saveSecretKey() {
    if (!secretKeyInput.trim()) {
      setError('Paste your Stripe secret key first')
      return
    }
    setSavingKey(true)
    setError('')
    setSuccessMessage('')
    try {
      const response = await apiFetch('/api/stripe/save-secret-key', {
        method: 'POST',
        body: JSON.stringify({ secret_key: secretKeyInput.trim() }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not save your Stripe key')
      setSuccessMessage('Stripe key saved — sync revenue to get started.')
      setSecretKeyInput('')
      setEditingKey(false)
      await refreshStatus()
    } catch (err) {
      setError(err.message || 'Could not save your Stripe key')
    } finally {
      setSavingKey(false)
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
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="flex-1">
            <h2 className="text-sm font-semibold text-text-primary mb-1">Stripe Revenue Connection</h2>
            <p className="text-xs text-text-secondary mb-2">
              Paste your Stripe secret key so we can read (read-only) the revenue we help you generate. Find it at{' '}
              <span className="text-text-primary">dashboard.stripe.com/apikeys</span>.
            </p>
            <span className={statusPillClass}>
              {status.connected ? 'Connected' : 'Not connected'}
            </span>
            {status.stripeKeyValid && status.stripeKeyAddedAt && (
              <p className="text-xs text-text-secondary mt-2">
                Key added on {formatDateTime(status.stripeKeyAddedAt)}
              </p>
            )}
            {status.connected && !status.stripeKeyValid && (
              <p className="text-xs text-text-secondary mt-2">
                Connected via our older method — paste your Stripe secret key below to switch to the simpler, direct method.
              </p>
            )}
          </div>
          {status.connected && !editingKey && (
            <button
              onClick={syncRevenue}
              disabled={syncing || loading}
              className="text-xs px-3 py-2 border border-vc-primary text-vc-primary hover:bg-vc-primary/10 rounded transition-colors disabled:opacity-60 flex-shrink-0"
            >
              {syncing ? 'Syncing...' : 'Sync now'}
            </button>
          )}
        </div>

        {status.stripeKeyValid && !editingKey ? (
          <div className="flex items-center justify-between gap-3 bg-bg-tertiary rounded px-3 py-2">
            <span className="text-sm font-mono text-text-secondary">{status.stripeKeyMasked || '••••••••'}</span>
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
              value={secretKeyInput}
              onChange={(e) => setSecretKeyInput(e.target.value)}
              placeholder="sk_live_..."
              className="flex-1 text-sm bg-bg-tertiary border border-white/[0.08] rounded px-3 py-2 text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-vc-primary"
            />
            <div className="flex gap-2">
              <button
                onClick={saveSecretKey}
                disabled={savingKey}
                className="text-xs px-3 py-2 bg-vc-primary text-white hover:bg-vc-accent rounded transition-colors disabled:opacity-60 flex-shrink-0"
              >
                {savingKey ? 'Saving...' : 'Save key'}
              </button>
              {status.stripeKeyValid && (
                <button
                  onClick={() => { setEditingKey(false); setSecretKeyInput(''); setError('') }}
                  className="text-xs px-3 py-2 text-text-secondary hover:text-text-primary rounded transition-colors flex-shrink-0"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        )}
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
