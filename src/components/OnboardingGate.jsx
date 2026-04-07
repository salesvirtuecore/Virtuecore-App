import { useEffect, useState } from 'react'
import { CheckCircle, Circle, ExternalLink } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { apiFetch } from '../lib/api'

// Locks the client portal until they have completed:
// 1. Connected their Stripe account (read-only revenue tracking)
// 2. Saved a payment method on file
// 3. Connected their Facebook Ads account
export default function OnboardingGate({ children }) {
  const { profile } = useAuth()
  const [loading, setLoading] = useState(true)
  const [setup, setSetup] = useState({
    stripeRevenue: false,
    paymentMethod: false,
    facebook: false,
  })
  const [connectingStripe, setConnectingStripe] = useState(false)
  const [savingCard, setSavingCard] = useState(false)
  const [connectingMeta, setConnectingMeta] = useState(false)
  const [error, setError] = useState('')

  async function loadStatus() {
    if (!profile?.client_id) {
      setLoading(false)
      return
    }
    try {
      const { data } = await supabase.from('clients')
        .select('stripe_account_id, default_payment_method_id, meta_ad_account_id')
        .eq('id', profile.client_id)
        .single()
      setSetup({
        stripeRevenue: Boolean(data?.stripe_account_id),
        paymentMethod: Boolean(data?.default_payment_method_id),
        facebook: Boolean(data?.meta_ad_account_id),
      })
    } catch {
      // Default to all false if we can't read
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadStatus()
  }, [profile?.client_id])

  // Refresh after returning from any redirect
  useEffect(() => {
    function onFocus() { loadStatus() }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [profile?.client_id])

  async function startStripeConnect() {
    setError('')
    setConnectingStripe(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/stripe/client-connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to start Stripe connect')
      window.location.assign(data.connectUrl)
    } catch (err) {
      setError(err.message)
      setConnectingStripe(false)
    }
  }

  async function startSaveCard() {
    setError('')
    setSavingCard(true)
    try {
      const res = await apiFetch('/api/stripe/setup-payment-method', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to start card setup')
      window.location.assign(data.url)
    } catch (err) {
      setError(err.message)
      setSavingCard(false)
    }
  }

  async function startMetaConnect() {
    setError('')
    setConnectingMeta(true)
    try {
      const res = await apiFetch(`/api/meta/connect?client_id=${profile.client_id}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to start Facebook connect')
      window.location.assign(data.url)
    } catch (err) {
      setError(err.message)
      setConnectingMeta(false)
    }
  }

  // VAs and admins skip the gate entirely
  if (profile?.role !== 'client') return children

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-primary">
        <p className="text-sm text-text-secondary">Loading...</p>
      </div>
    )
  }

  const allComplete = setup.stripeRevenue && setup.paymentMethod && setup.facebook
  if (allComplete) return children

  // Render onboarding wall
  const steps = [
    {
      key: 'stripeRevenue',
      done: setup.stripeRevenue,
      title: 'Connect your Stripe account',
      description: 'Read-only access so we can track the revenue we help you generate. We can never move funds.',
      buttonLabel: connectingStripe ? 'Redirecting…' : 'Connect Stripe',
      onClick: startStripeConnect,
      loading: connectingStripe,
    },
    {
      key: 'paymentMethod',
      done: setup.paymentMethod,
      title: 'Save a payment method',
      description: 'Add a card on file so your monthly invoices are charged automatically. You can cancel any time.',
      buttonLabel: savingCard ? 'Redirecting…' : 'Add card',
      onClick: startSaveCard,
      loading: savingCard,
    },
    {
      key: 'facebook',
      done: setup.facebook,
      title: 'Connect your Facebook Ads account',
      description: 'So we can pull your ad performance data into your dashboard.',
      buttonLabel: connectingMeta ? 'Redirecting…' : 'Connect Facebook',
      onClick: startMetaConnect,
      loading: connectingMeta,
    },
  ]
  const completedCount = steps.filter((s) => s.done).length

  return (
    <div className="min-h-screen bg-bg-primary p-6 flex items-center justify-center">
      <div className="max-w-xl w-full">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 mb-3">
            <div className="w-8 h-8 bg-vc-primary rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">V</span>
            </div>
            <span className="font-semibold text-text-primary text-lg font-heading">VirtueCore</span>
          </div>
          <h1 className="text-2xl font-semibold text-text-primary font-heading">Welcome to your portal</h1>
          <p className="text-sm text-text-secondary mt-2">
            Complete these {steps.length} steps to access your dashboard. ({completedCount}/{steps.length} done)
          </p>
        </div>

        {error && (
          <div className="mb-4 px-4 py-3 border border-status-danger/20 bg-status-danger/10 text-sm text-status-danger rounded">
            {error}
          </div>
        )}

        <div className="space-y-3">
          {steps.map((step) => (
            <div
              key={step.key}
              className={`border rounded-card p-5 transition-colors ${
                step.done ? 'border-status-success/30 bg-status-success/5' : 'border-white/[0.08] bg-bg-elevated'
              }`}
            >
              <div className="flex items-start gap-3">
                {step.done ? (
                  <CheckCircle size={20} className="text-status-success flex-shrink-0 mt-0.5" />
                ) : (
                  <Circle size={20} className="text-text-tertiary flex-shrink-0 mt-0.5" />
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-text-primary">{step.title}</h3>
                  <p className="text-xs text-text-secondary mt-1 leading-relaxed">{step.description}</p>
                </div>
              </div>
              {!step.done && (
                <div className="mt-4 ml-7">
                  <button
                    onClick={step.onClick}
                    disabled={step.loading}
                    className="text-xs px-4 py-2 bg-vc-primary text-white hover:bg-vc-accent rounded transition-colors disabled:opacity-60 inline-flex items-center gap-1.5"
                  >
                    <ExternalLink size={12} />
                    {step.buttonLabel}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        <p className="text-xs text-text-tertiary text-center mt-6">
          Need help? Email <a href="mailto:sales@virtuecore.co.uk" className="text-vc-primary hover:underline">sales@virtuecore.co.uk</a>
        </p>
      </div>
    </div>
  )
}
