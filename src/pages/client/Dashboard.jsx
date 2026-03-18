import { useEffect, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import StatCard from '../../components/ui/StatCard'
import { DEMO_AD_PERFORMANCE, DEMO_CLIENT_METRICS } from '../../data/placeholder'
import { useAuth } from '../../context/AuthContext'
import { supabase, isDemoMode } from '../../lib/supabase'

export default function ClientDashboard() {
  const { profile } = useAuth()
  const m = DEMO_CLIENT_METRICS
  const [stripeStatus, setStripeStatus] = useState({ loading: !isDemoMode, connected: false, accountId: null })
  const [stripeError, setStripeError] = useState('')
  const [connecting, setConnecting] = useState(false)

  function formatStripeError(message) {
    if (!message) return 'Stripe connection failed'
    if (message.includes('clients.stripe_account_id')) {
      return 'Stripe setup is still being finalized by the admin. Please try again in a few minutes.'
    }
    return message
  }

  useEffect(() => {
    if (isDemoMode || !profile?.id) return

    async function loadStripeStatus() {
      setStripeError('')

      let query = supabase
        .from('clients')
        .select('id, stripe_account_id')

      if (profile.client_id) {
        query = query.eq('id', profile.client_id)
      } else {
        query = query.eq('contact_email', profile.email)
      }

      const { data, error } = await query.maybeSingle()

      if (error) {
        setStripeStatus({ loading: false, connected: false, accountId: null })
        setStripeError('Could not load Stripe status')
        return
      }

      setStripeStatus({
        loading: false,
        connected: Boolean(data?.stripe_account_id),
        accountId: data?.stripe_account_id || null,
      })
    }

    loadStripeStatus()
  }, [profile?.id, profile?.client_id, profile?.email])

  async function connectStripe() {
    if (isDemoMode) return

    setStripeError('')
    setConnecting(true)

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

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Stripe connect failed')

      setStripeStatus({ loading: false, connected: true, accountId: data.stripeAccountId || null })

      if (data.connectUrl) {
        window.open(data.connectUrl, '_blank', 'noreferrer')
      }
    } catch (err) {
      setStripeError(formatStripeError(err.message))
    } finally {
      setConnecting(false)
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-vc-text">
          Hello, {profile?.full_name?.split(' ')[0] ?? 'there'} 👋
        </h1>
        <p className="text-sm text-vc-muted mt-0.5">Here's your performance snapshot for March 2026.</p>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Ad Spend (Mar)" value={`£${m.ad_spend.toLocaleString()}`} sub="Meta + Google" />
        <StatCard label="Leads Generated" value={m.leads} sub="This month" />
        <StatCard label="Cost Per Lead" value={`£${m.cpl}`} trend={6.4} />
        <StatCard label="ROAS" value={`${m.roas}x`} trend={7.2} />
      </div>

      {/* Secondary metrics */}
      <div className="grid grid-cols-3 gap-3">
        <div className="border border-vc-border p-4">
          <p className="text-xs text-vc-muted uppercase tracking-wide">Clicks</p>
          <p className="text-2xl font-semibold text-vc-text mt-1">{m.clicks.toLocaleString()}</p>
        </div>
        <div className="border border-vc-border p-4">
          <p className="text-xs text-vc-muted uppercase tracking-wide">Impressions</p>
          <p className="text-2xl font-semibold text-vc-text mt-1">{m.impressions.toLocaleString()}</p>
        </div>
        <div className="border border-vc-border p-4">
          <p className="text-xs text-vc-muted uppercase tracking-wide">CTR</p>
          <p className="text-2xl font-semibold text-vc-text mt-1">{m.ctr}%</p>
        </div>
      </div>

      {/* Stripe integration */}
      <div className="border border-[#c7d2fe] bg-gradient-to-r from-[#eef2ff] to-[#f8f7ff] p-5 flex items-center justify-between gap-4 rounded">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#635bff]">Stripe</span>
            <span className="text-xs text-[#4f46e5] bg-white/80 border border-[#c7d2fe] px-2 py-0.5 rounded">Revenue Sync</span>
          </div>
          <h2 className="text-sm font-semibold text-[#312e81] mt-1">Stripe Revenue Integration</h2>
          <p className="text-sm text-[#4338ca] mt-1">
            Connect your own Stripe account so VirtueCore can track your invoice revenue automatically.
          </p>
          {!isDemoMode && stripeStatus.connected && (
            <p className="text-xs text-green-700 mt-2">
              Connected{stripeStatus.accountId ? ` (${stripeStatus.accountId})` : ''}
            </p>
          )}
          {!isDemoMode && stripeError && (
            <p className="text-xs text-red-600 mt-2">{stripeError}</p>
          )}
        </div>

        {isDemoMode ? (
          <button className="text-xs px-3 py-2 border border-[#c7d2fe] text-[#6366f1] bg-white rounded" disabled>
            Demo mode
          </button>
        ) : stripeStatus.loading ? (
          <button className="text-xs px-3 py-2 border border-[#c7d2fe] text-[#6366f1] bg-white rounded" disabled>
            Checking...
          </button>
        ) : stripeStatus.connected ? (
          <button
            onClick={connectStripe}
            disabled={connecting}
            className="text-xs px-3 py-2 border border-[#635bff] text-[#4338ca] bg-white hover:bg-[#eef2ff] rounded transition-colors"
          >
            {connecting ? 'Opening...' : 'Manage Stripe'}
          </button>
        ) : (
          <button
            onClick={connectStripe}
            disabled={connecting}
            className="text-xs px-3 py-2 bg-[#635bff] text-white hover:bg-[#4f46e5] rounded transition-colors"
          >
            {connecting ? 'Connecting...' : 'Connect Stripe'}
          </button>
        )}
      </div>

      {/* Platform split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="border border-vc-border p-5">
          <h2 className="text-sm font-medium text-vc-text mb-4">Platform Split</h2>
          {m.platform_split.map((p) => (
            <div key={p.platform} className="mb-4 last:mb-0">
              <div className="flex justify-between text-sm mb-1.5">
                <span className="text-vc-text font-medium">{p.platform}</span>
                <span className="text-vc-muted">£{p.spend.toLocaleString()} · {p.leads} leads</span>
              </div>
              <div className="h-1.5 bg-vc-border">
                <div
                  className="h-full bg-vc-text"
                  style={{ width: `${(p.spend / m.ad_spend) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Trend chart */}
        <div className="lg:col-span-2 border border-vc-border p-5">
          <h2 className="text-sm font-medium text-vc-text mb-4">Lead Trend (6 months)</h2>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={DEMO_AD_PERFORMANCE}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#666666' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#666666' }} axisLine={false} tickLine={false} />
              <Tooltip />
              <Line type="monotone" dataKey="leads" stroke="#D4A843" strokeWidth={2} dot={{ r: 3, fill: '#D4A843' }} name="Leads" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'View Deliverables', sub: '1 pending review', href: '/client/deliverables' },
          { label: 'Content Calendar', sub: '4 posts scheduled', href: '/client/calendar' },
          { label: 'Messages', sub: '3 unread', href: '/client/messages' },
          { label: 'Invoices', sub: 'Next due Apr 1', href: '/client/invoices' },
        ].map((item) => (
          <a
            key={item.href}
            href={item.href}
            className="border border-vc-border p-4 hover:border-vc-text transition-colors block"
          >
            <p className="text-sm font-medium text-vc-text">{item.label}</p>
            <p className="text-xs text-vc-muted mt-0.5">{item.sub}</p>
          </a>
        ))}
      </div>
    </div>
  )
}
