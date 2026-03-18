import { useEffect, useMemo, useState } from 'react'
import Button from '../../components/ui/Button'
import { useAuth } from '../../context/AuthContext'
import { supabase, isDemoMode } from '../../lib/supabase'

function formatDateTime(iso) {
  if (!iso) return 'Not checked yet'
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function Billing() {
  const { profile } = useAuth()
  const [loading, setLoading] = useState(!isDemoMode)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState({
    connected: false,
    stripeAccountId: null,
    clientId: null,
    companyName: null,
    lastCheckedAt: null,
  })

  const statusPillClass = useMemo(() => {
    return status.connected
      ? 'text-xs font-medium text-green-700 bg-green-100 px-2 py-1 rounded'
      : 'text-xs font-medium text-amber-800 bg-amber-100 px-2 py-1 rounded'
  }, [status.connected])

  async function refreshStatus() {
    if (isDemoMode || !profile?.id) return

    setLoading(true)
    setError('')

    try {
      let query = supabase
        .from('clients')
        .select('id, company_name, stripe_account_id')

      if (profile.client_id) {
        query = query.eq('id', profile.client_id)
      } else {
        query = query.eq('contact_email', profile.email)
      }

      const { data, error: queryError } = await query.maybeSingle()
      if (queryError) throw queryError

      setStatus({
        connected: Boolean(data?.stripe_account_id),
        stripeAccountId: data?.stripe_account_id || null,
        clientId: data?.id || null,
        companyName: data?.company_name || null,
        lastCheckedAt: new Date().toISOString(),
      })
    } catch (err) {
      setError(err.message || 'Could not load billing status')
      setStatus((prev) => ({ ...prev, lastCheckedAt: new Date().toISOString() }))
    } finally {
      setLoading(false)
    }
  }

  async function connectStripe() {
    if (isDemoMode) return

    setConnecting(true)
    setError('')

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.access_token) {
        throw new Error('Session expired. Please sign in again.')
      }

      const response = await fetch('/api/stripe/client-connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
      })

      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Stripe connect failed')

      setStatus((prev) => ({
        ...prev,
        connected: true,
        stripeAccountId: payload.stripeAccountId || prev.stripeAccountId,
        clientId: payload.clientId || prev.clientId,
        lastCheckedAt: new Date().toISOString(),
      }))

      if (payload.connectUrl) {
        window.open(payload.connectUrl, '_blank', 'noreferrer')
      }
    } catch (err) {
      setError(err.message || 'Stripe connect failed')
    } finally {
      setConnecting(false)
    }
  }

  useEffect(() => {
    refreshStatus()
  }, [profile?.id, profile?.client_id, profile?.email])

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-vc-text">Billing</h1>
        <p className="text-sm text-vc-muted mt-0.5">
          Connect your Stripe account to sync revenue and payment performance into VirtueCore.
        </p>
      </div>

      <div className="border border-vc-border p-5 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-vc-text">Stripe Connection Status</p>
            <p className="text-xs text-vc-muted mt-1">Last sync check: {formatDateTime(status.lastCheckedAt)}</p>
          </div>
          {isDemoMode ? (
            <span className="text-xs font-medium text-vc-muted bg-vc-secondary px-2 py-1 rounded">Demo</span>
          ) : (
            <span className={statusPillClass}>{status.connected ? 'Connected' : 'Not connected'}</span>
          )}
        </div>

        {status.companyName && (
          <div className="text-sm text-vc-text">
            <span className="text-vc-muted">Company:</span> {status.companyName}
          </div>
        )}

        {!isDemoMode && status.stripeAccountId && (
          <div className="text-sm text-vc-text">
            <span className="text-vc-muted">Stripe Account ID:</span> {status.stripeAccountId}
          </div>
        )}

        {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 px-3 py-2">{error}</p>}

        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={refreshStatus} disabled={loading || isDemoMode}>
            {loading ? 'Refreshing...' : 'Refresh Status'}
          </Button>

          <Button variant="gold" size="sm" onClick={connectStripe} disabled={connecting || loading || isDemoMode}>
            {connecting ? 'Opening Stripe...' : status.connected ? 'Manage Stripe' : 'Connect Stripe'}
          </Button>
        </div>
      </div>

      <div className="border border-vc-border p-5">
        <h2 className="text-sm font-medium text-vc-text mb-2">What happens after you connect</h2>
        <p className="text-sm text-vc-muted">
          Once connected, your Stripe account can be used to reconcile invoice payments and track client revenue performance directly in your portal.
        </p>
      </div>
    </div>
  )
}
