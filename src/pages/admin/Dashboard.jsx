import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TrendingUp, Users, DollarSign, Activity, Repeat } from 'lucide-react'
import { AreaChart, Area, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import StatCard from '../../components/ui/StatCard'
import Badge from '../../components/ui/Badge'
import { supabase } from '../../lib/supabase'
import { withPortalStatus } from '../../lib/clientUtils'
import { useAuth } from '../../context/AuthContext'
import { apiFetch } from '../../lib/api'
import { buildMonthlyForecast } from '../../lib/forecast'

const HEALTH_BADGE = { green: 'green', amber: 'amber', red: 'red' }

function fmt(n) {
  return n >= 1000 ? `£${(n / 1000).toFixed(1)}k` : `£${n}`
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-bg-elevated border border-white/[0.08] rounded px-3 py-2 text-xs shadow-elevated space-y-1">
      <p className="text-text-secondary">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="text-text-primary font-mono-data font-semibold" style={{ color: p.stroke || p.fill }}>
          {p.name}: £{Number(p.value || 0).toLocaleString()}
        </p>
      ))}
    </div>
  )
}

// Turns { "2026-01": 400, ... } into a sorted, chart-ready array.
function buildRevenueSeries(revenueByMonth) {
  return Object.keys(revenueByMonth || {})
    .sort()
    .map((key) => {
      const [year, month] = key.split('-').map(Number)
      const date = new Date(Date.UTC(year, month - 1, 1))
      return {
        month: date.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }),
        sortKey: date.getTime(),
        revenue: revenueByMonth[key],
      }
    })
}

export default function AdminDashboard() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [clients, setClients] = useState([])
  const [pipelineLeads, setPipelineLeads] = useState([])
  const [agencyRevenue, setAgencyRevenue] = useState(null)

  useEffect(() => {
    apiFetch('/api/stripe/agency-overview')
      .then((r) => r.json())
      .then((data) => setAgencyRevenue(data?.connected ? data : null))
      .catch(() => setAgencyRevenue(null))
  }, [])

  const [totalAdSpendManaged, setTotalAdSpendManaged] = useState(0)

  const loadClients = useCallback(async () => {
    if (!supabase) return
    const [{ data: clientRows, error: clientError }, { data: profileRows, error: profileError }, { data: leads }] = await Promise.all([
      supabase.from('clients').select('id, status, company_name, contact_name, monthly_retainer, health_score, package_tier, created_at, stripe_total_revenue, stripe_revenue_last_90d').order('created_at', { ascending: false }),
      supabase.from('profiles').select('client_id, created_at').not('client_id', 'is', null),
      supabase.from('pipeline_leads').select('id, score, stage').neq('stage', 'contract_signed'),
    ])
    if (!clientError && !profileError && clientRows) {
      setClients(withPortalStatus(clientRows, profileRows || []))
    }
    if (leads) setPipelineLeads(leads)
  }, [])

  // Total ad spend the agency manages across every client's campaigns.
  useEffect(() => {
    if (!supabase) return
    supabase.from('ad_performance').select('spend').then(({ data }) => {
      setTotalAdSpendManaged((data || []).reduce((sum, row) => sum + Number(row.spend || 0), 0))
    })
  }, [])

  useEffect(() => { loadClients() }, [loadClients])

  useEffect(() => {
    if (!supabase) return
    const channel = supabase
      .channel('admin-dashboard-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clients' }, () => loadClients())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, (payload) => {
        if (payload?.new?.client_id || payload?.old?.client_id) loadClients()
      })
      .subscribe()
    const onVisible = () => { if (document.visibilityState === 'visible') loadClients() }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      supabase.removeChannel(channel)
    }
  }, [loadClients])

  const activeClients = clients.filter(c => c.status === 'active')
  const onboardingClients = clients.filter(c => c.status === 'onboarding')
  const joinedClients = clients.filter(c => c.portal_joined)
  const retainerSum = activeClients.reduce((sum, c) => sum + Number(c.monthly_retainer || 0), 0)
  // Real Stripe MRR when the agency's own account is connected — falls back
  // to summed contracted retainers (not what was actually charged/collected)
  // if AGENCY_STRIPE_SECRET_KEY hasn't been set yet.
  const mrr = agencyRevenue ? agencyRevenue.mrr : retainerSum
  const revenueSeries = agencyRevenue ? buildRevenueSeries(agencyRevenue.revenueByMonth) : []
  const forecastRows = agencyRevenue ? buildMonthlyForecast(revenueSeries) : []
  const combinedRevenueData = forecastRows.length
    ? (() => {
        const withNulls = revenueSeries.map((row) => ({ ...row, revenueForecast: null }))
        const lastReal = withNulls[withNulls.length - 1]
        if (lastReal) lastReal.revenueForecast = lastReal.revenue
        return [...withNulls, ...forecastRows.map((row) => ({ ...row, revenue: null }))]
      })()
    : revenueSeries
  const nextMonthForecast = forecastRows[0] || null
  // Rollup across every client's OWN Stripe revenue (distinct from the
  // agency's own income above) and the ad spend managed on their behalf.
  const totalClientRevenue = clients.reduce((sum, c) => sum + Number(c.stripe_total_revenue || 0), 0)
  const totalClientRevenueLast90d = clients.reduce((sum, c) => sum + Number(c.stripe_revenue_last_90d || 0), 0)
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening'

  return (
    <div className="p-6 space-y-6 max-w-[1440px] mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-h2 font-heading text-text-primary">
          Good {greeting}, {profile?.full_name?.split(' ')[0] ?? 'Samuel'}
        </h1>
        <p className="text-text-secondary text-sm mt-1">Here's your agency overview.</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label={agencyRevenue ? 'Monthly Revenue (Stripe)' : 'Monthly Revenue (retainers)'}
          value={fmt(mrr)}
          sub={agencyRevenue?.revenueLast90Days ? `£${Number(agencyRevenue.totalRevenue).toLocaleString()} last 12mo` : null}
          icon={DollarSign}
        />
        <StatCard
          label="Active Clients"
          value={activeClients.length}
          sub={`${joinedClients.length} in portal · ${onboardingClients.length} onboarding`}
          icon={Users}
        />
        <StatCard label="Pipeline Leads" value={pipelineLeads.length} icon={TrendingUp} />
        <StatCard
          label="Active Subscriptions"
          value={agencyRevenue ? agencyRevenue.activeSubscriptions : '—'}
          sub={agencyRevenue ? `${agencyRevenue.customerCount} customers` : 'Set AGENCY_STRIPE_SECRET_KEY'}
          icon={Repeat}
        />
      </div>

      {/* Across-your-clients rollup — their own Stripe revenue + ad spend
          you manage on their behalf, distinct from the agency's own income above */}
      <div>
        <p className="vc-section-label mb-2">Across Your Clients</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Total Revenue Produced"
            value={fmt(totalClientRevenue)}
            sub={`£${Number(totalClientRevenueLast90d).toLocaleString()} last 90 days`}
            icon={DollarSign}
          />
          <StatCard
            label="Total Ad Spend Managed"
            value={fmt(totalAdSpendManaged)}
            icon={Activity}
          />
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Revenue Area Chart */}
        <div className="vc-card lg:col-span-2">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-sm font-semibold text-text-primary font-heading">Revenue Trend</h2>
              <p className="text-xs text-text-tertiary mt-0.5">
                {agencyRevenue ? 'Real revenue from your Stripe account, with a trend-based forecast.' : 'Connect AGENCY_STRIPE_SECRET_KEY to see real revenue here.'}
              </p>
            </div>
            <span className="vc-section-label">12 months</span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={combinedRevenueData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="mrrGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6C5CE7" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6C5CE7" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#5A5A5E' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#5A5A5E' }} axisLine={false} tickLine={false} tickFormatter={v => `£${v/1000}k`} width={40} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#6C5CE7" strokeWidth={2} fill="url(#mrrGrad)" dot={false} activeDot={{ r: 4, fill: '#6C5CE7' }} isAnimationActive animationBegin={0} animationDuration={900} animationEasing="ease-out" />
              {forecastRows.length > 0 && (
                <Line type="monotone" dataKey="revenueForecast" name="Forecast" stroke="#6C5CE7" strokeWidth={2} strokeDasharray="6 4" dot={false} activeDot={{ r: 4, fill: '#6C5CE7' }} connectNulls isAnimationActive={false} />
              )}
            </AreaChart>
          </ResponsiveContainer>
          {nextMonthForecast && (
            <div className="flex items-center gap-6 mt-4 pt-4 border-t border-white/[0.06]">
              <div>
                <p className="text-xs text-text-secondary">Next month forecast</p>
                <p className="text-lg font-semibold text-text-primary mt-0.5">£{Number(nextMonthForecast.revenueForecast).toLocaleString()}</p>
              </div>
              <p className="text-xs text-text-tertiary">Trend-based projection from {revenueSeries.length} months of real Stripe data — not a guarantee.</p>
            </div>
          )}
        </div>

        {/* Pending Actions */}
        <div className="vc-card">
          <h2 className="text-sm font-semibold text-text-primary font-heading mb-4">Needs Attention</h2>
          <div className="space-y-1">
            {clients.filter(c => c.status === 'onboarding').length > 0 && (
              <div className="flex items-start gap-3 py-3 border-b border-white/[0.04] cursor-pointer hover:bg-bg-tertiary -mx-2 px-2 rounded transition-colors">
                <div className="w-1.5 h-1.5 rounded-full bg-status-warning mt-1.5 flex-shrink-0" />
                <div>
                  <p className="text-sm text-text-primary">{clients.filter(c => c.status === 'onboarding').length} client{clients.filter(c => c.status === 'onboarding').length > 1 ? 's' : ''} onboarding</p>
                  <p className="text-xs text-text-tertiary mt-0.5">{clients.filter(c => c.status === 'onboarding').map(c => c.company_name).join(', ')}</p>
                </div>
              </div>
            )}
            {clients.filter(c => c.health_score === 'red').map(c => (
              <div key={c.id} className="flex items-start gap-3 py-3 border-b border-white/[0.04] cursor-pointer hover:bg-bg-tertiary -mx-2 px-2 rounded transition-colors" onClick={() => navigate(`/admin/clients/${c.id}`)}>
                <div className="w-1.5 h-1.5 rounded-full bg-status-danger mt-1.5 flex-shrink-0" />
                <div>
                  <p className="text-sm text-text-primary">Health score red</p>
                  <p className="text-xs text-text-tertiary mt-0.5">{c.company_name}</p>
                </div>
              </div>
            ))}
            {clients.length > 0 && clients.filter(c => c.status === 'onboarding').length === 0 && clients.filter(c => c.health_score === 'red').length === 0 && (
              <p className="text-sm text-text-secondary py-3">Nothing needs your attention right now.</p>
            )}
          </div>
        </div>
      </div>

      {/* Client Health Table */}
      <div className="vc-card p-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
          <h2 className="text-sm font-semibold text-text-primary font-heading">Client Health</h2>
          <span className="text-xs text-text-tertiary">{activeClients.length} active</span>
        </div>
        <div className="overflow-x-auto">
          <table className="vc-table min-w-[800px]">
            <thead>
              <tr>
                <th>Client</th>
                <th>Package</th>
                <th>Retainer</th>
                <th>Portal</th>
                <th>Health</th>
              </tr>
            </thead>
            <tbody>
              {clients.filter(c => c.status !== 'churned').map(c => (
                <tr key={c.id} onClick={() => navigate(`/admin/clients/${c.id}`)} className="cursor-pointer">
                  <td>
                    <p className="text-text-primary font-medium">{c.company_name}</p>
                    <p className="text-xs text-text-tertiary">{c.contact_name}</p>
                  </td>
                  <td className="text-text-secondary">{c.package_tier}</td>
                  <td className="mono">£{Number(c.monthly_retainer || 0).toLocaleString()}</td>
                  <td>
                    <Badge variant={c.portal_joined ? 'green' : 'blue'} dot>
                      {c.portal_joined ? 'Joined' : 'Invited'}
                    </Badge>
                  </td>
                  <td>
                    <Badge variant={HEALTH_BADGE[c.health_score]} dot>
                      {(c.health_score || 'unknown').charAt(0).toUpperCase() + (c.health_score || 'unknown').slice(1)}
                    </Badge>
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
