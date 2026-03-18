import { useEffect, useMemo, useRef, useState } from 'react'
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
    onboardingComplete: false,
    chargesEnabled: false,
    payoutsEnabled: false,
    stripeAccountId: null,
    clientId: null,
    companyName: null,
    lastCheckedAt: null,
  })

  const statusPillClass = useMemo(() => {
    return status.connected
      ? 'text-xs font-medium text-green-700 bg-green-100 px-2 py-1 rounded'
      : 'text-xs font-medium text-[#4338ca] bg-[#e0e7ff] px-2 py-1 rounded'
  }, [status.connected])

  function formatStripeError(message) {
    if (!message) return 'Stripe connect failed'
    if (message.includes('clients.stripe_account_id')) {
      return 'Stripe setup is still being finalized by the admin. Please try again in a few minutes.'
    }
    if (message.includes('Stripe Connect is not enabled')) {
      return 'Stripe Connect is not enabled yet on the platform account. Please ask admin to enable it in Stripe settings.'
    }
    return message
  }

  async function getAccessToken() {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session?.access_token) {
      throw new Error('Session expired. Please sign in again.')
    }

    return session.access_token
  }

  async function refreshStatus() {
    if (isDemoMode || !profile?.id) return

    setLoading(true)
    setError('')

    try {
      const accessToken = await getAccessToken()
      const response = await fetch('/api/stripe/client-connect', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not load Stripe status')

      setStatus({
        connected: Boolean(data?.stripeAccountId),
        onboardingComplete: Boolean(data?.onboardingComplete),
        chargesEnabled: Boolean(data?.chargesEnabled),
        payoutsEnabled: Boolean(data?.payoutsEnabled),
        stripeAccountId: data?.stripeAccountId || null,
        clientId: data?.clientId || null,
        companyName: data?.companyName || null,
        lastCheckedAt: new Date().toISOString(),
      })
    } catch (err) {
      setError(formatStripeError(err.message))
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
      const accessToken = await getAccessToken()

      const response = await fetch('/api/stripe/client-connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
      })

      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Stripe connect failed')

      setStatus((prev) => ({
        ...prev,
        connected: Boolean(payload?.stripeAccountId),
        onboardingComplete: Boolean(payload?.onboardingComplete),
        chargesEnabled: Boolean(payload?.chargesEnabled),
        payoutsEnabled: Boolean(payload?.payoutsEnabled),
        stripeAccountId: payload?.stripeAccountId || prev.stripeAccountId,
        clientId: payload?.clientId || prev.clientId,
        companyName: payload?.companyName || prev.companyName,
        lastCheckedAt: new Date().toISOString(),
      }))

      if (payload.connectUrl) {
        window.location.assign(payload.connectUrl)
      }
    } catch (err) {
      setError(formatStripeError(err.message))
    } finally {
      setConnecting(false)
    }
  }

  // Keep a ref so the focus listener always calls the latest refreshStatus
  const refreshStatusRef = useRef(refreshStatus)
  useEffect(() => { refreshStatusRef.current = refreshStatus })

  useEffect(() => {
    refreshStatus()
  }, [profile?.id, profile?.client_id, profile?.email])

  // Auto-refresh when returning from Stripe onboarding tab
  useEffect(() => {
    const handleFocus = () => refreshStatusRef.current()
    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [])
  return (
    <div className="p-6 space-y-5">
      <div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#635bff]">Stripe</span>
          <span className="text-xs text-[#4f46e5] bg-[#eef2ff] border border-[#c7d2fe] px-2 py-0.5 rounded">Client Billing</span>
        </div>
        <h1 className="text-xl font-semibold text-vc-text mt-1">Billing</h1>
        <p className="text-sm text-vc-muted mt-0.5">
          Connect your Stripe account to sync revenue and payment performance into VirtueCore.
        </p>
      </div>

      <div className="border border-[#c7d2fe] bg-gradient-to-r from-[#eef2ff] to-[#f8f7ff] p-5 space-y-4 rounded">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-[#312e81]">Stripe Connection Status</p>
            <p className="text-xs text-[#4338ca] mt-1">Last sync check: {formatDateTime(status.lastCheckedAt)}</p>
          </div>
          {isDemoMode ? (
            <span className="text-xs font-medium text-vc-muted bg-vc-secondary px-2 py-1 rounded">Demo</span>
          ) : (
            <span className={statusPillClass}>
              {status.connected ? (status.onboardingComplete ? 'Connected' : 'Setup incomplete') : 'Not connected'}
            </span>
          )}
        </div>

        {status.companyName && (
          <div className="text-sm text-vc-text">
            <span className="text-[#4f46e5]">Company:</span> {status.companyName}
          </div>
        )}

        {!isDemoMode && status.stripeAccountId && (
          <div className="text-sm text-vc-text">
            <span className="text-[#4f46e5]">Stripe Account ID:</span> {status.stripeAccountId}
          </div>
        )}

        {!isDemoMode && status.connected && !status.onboardingComplete && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-3 py-2 rounded">
            Your Stripe account exists, but onboarding is not finished yet. Use the button below to continue setup.
          </p>
        )}

        {!isDemoMode && status.onboardingComplete && !status.chargesEnabled && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-3 py-2 rounded">
            Stripe onboarding is submitted, but charges are not enabled yet. Stripe may still be reviewing the account.
          </p>
        )}

        {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 px-3 py-2">{error}</p>}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={refreshStatus}
            disabled={loading || isDemoMode}
            className="text-xs px-3 py-2 border border-[#635bff] text-[#4338ca] bg-white hover:bg-[#eef2ff] rounded transition-colors disabled:opacity-60"
          >
            {loading ? 'Refreshing...' : 'Refresh Status'}
          </button>

          <button
            type="button"
            onClick={connectStripe}
            disabled={connecting || loading || isDemoMode}
            className="text-xs px-3 py-2 bg-[#635bff] text-white hover:bg-[#4f46e5] rounded transition-colors disabled:opacity-60"
          >
            {connecting ? 'Opening Stripe...' : status.onboardingComplete ? 'Manage Stripe' : status.connected ? 'Continue Stripe Setup' : 'Connect Stripe'}
          </button>
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
