import { useCallback, useEffect, useState } from 'react'
import { TrendingUp, Users, DollarSign, Activity, AlertTriangle, Clock } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import StatCard from '../../components/ui/StatCard'
import Badge from '../../components/ui/Badge'
import { DEMO_BUSINESS_METRICS, DEMO_MRR_CHART, DEMO_CLIENTS } from '../../data/placeholder'
import { isDemoMode, supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'

const HEALTH_BADGE = { green: 'green', amber: 'amber', red: 'red' }
const PORTAL_BADGE = { joined: 'green', invited: 'blue' }

function withPortalStatus(clientRows, profileRows = []) {
  const joinedByClientId = new Map()
  for (const profile of profileRows) {
    if (!profile?.client_id) continue
    const existing = joinedByClientId.get(profile.client_id)
    if (!existing || new Date(profile.created_at) < new Date(existing.created_at)) {
      joinedByClientId.set(profile.client_id, profile)
    }
  }
  return clientRows.map((client) => ({ ...client, portal_joined: joinedByClientId.has(client.id) }))
}

function fmt(n) {
  return n >= 1000 ? `£${(n / 1000).toFixed(1)}k` : `£${n}`
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-bg-elevated border border-white/[0.08] rounded px-3 py-2 text-xs shadow-elevated">
      <p className="text-text-secondary mb-1">{label}</p>
      <p className="text-text-primary font-mono-data font-semibold">£{payload[0].value?.toLocaleString()}</p>
    </div>
  )
}

export default function AdminDashboard() {
  const { profile } = useAuth()
  const m = DEMO_BUSINESS_METRICS
  const [clients, setClients] = useState(isDemoMode ? DEMO_CLIENTS : [])

  const loadClients = useCallback(async () => {
    if (isDemoMode || !supabase) return
    const [{ data: clientRows, error: clientError }, { data: profileRows, error: profileError }] = await Promise.all([
      supabase.from('clients').select('*').order('created_at', { ascending: false }),
      supabase.from('profiles').select('client_id, created_at').not('client_id', 'is', null),
    ])
    if (!clientError && !profileError && clientRows) {
      setClients(withPortalStatus(clientRows, profileRows || []))
    }
  }, [])

  useEffect(() => { loadClients() }, [loadClients])

  useEffect(() => {
    if (isDemoMode || !supabase) return
    const channel = supabase
      .channel('admin-dashboard-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clients' }, () => loadClients())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, (payload) => {
        if (payload?.new?.client_id || payload?.old?.client_id) loadClients()
      })
      .subscribe()
    const pollId = window.setInterval(loadClients, 15000)
    const onFocus = () => loadClients()
    const onVisible = () => { if (document.visibilityState === 'visible') loadClients() }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(pollId)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisible)
      supabase.removeChannel(channel)
    }
  }, [loadClients])

  const activeClients = clients.filter(c => c.status === 'active')
  const onboardingClients = clients.filter(c => c.status === 'onboarding')
  const joinedClients = clients.filter(c => c.portal_joined)
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
        <StatCard label="Monthly Revenue" value={fmt(m.mrr)} trend={m.mrr_change} icon={DollarSign} />
        <StatCard
          label="Active Clients"
          value={activeClients.length}
          sub={`${joinedClients.length} in portal · ${onboardingClients.length} onboarding`}
          icon={Users}
        />
        <StatCard label="Pipeline Value" value={fmt(m.pipeline_value)} sub="5 active leads" icon={TrendingUp} />
        <StatCard label="Ad Spend Managed" value={fmt(m.total_ad_spend)} trend={m.ad_spend_change} icon={Activity} />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* MRR Area Chart */}
        <div className="vc-card lg:col-span-2">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-sm font-semibold text-text-primary font-heading">Revenue Trend</h2>
            <span className="vc-section-label">12 weeks</span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={DEMO_MRR_CHART} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
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
              <Area type="monotone" dataKey="mrr" stroke="#6C5CE7" strokeWidth={2} fill="url(#mrrGrad)" dot={false} activeDot={{ r: 4, fill: '#6C5CE7' }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Pending Actions */}
        <div className="vc-card">
          <h2 className="text-sm font-semibold text-text-primary font-heading mb-4">Needs Attention</h2>
          <div className="space-y-1">
            {[
              { color: 'bg-status-danger', title: 'Overdue invoice', sub: 'Prestige Window — £1,500', icon: AlertTriangle },
              { color: 'bg-status-warning', title: '3 pending deliverables', sub: 'Prestige — awaiting VA', icon: Clock },
              { color: 'bg-status-warning', title: 'Proposal follow-up', sub: 'YC Financial — sent 3 days ago', icon: Clock },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-3 py-3 border-b border-white/[0.04] last:border-0 cursor-pointer hover:bg-bg-tertiary -mx-2 px-2 rounded transition-colors">
                <div className={`w-1.5 h-1.5 rounded-full ${item.color} mt-1.5 flex-shrink-0`} />
                <div>
                  <p className="text-sm text-text-primary">{item.title}</p>
                  <p className="text-xs text-text-tertiary mt-0.5">{item.sub}</p>
                </div>
              </div>
            ))}
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
          <table className="vc-table">
            <thead>
              <tr>
                <th>Client</th>
                <th>Package</th>
                <th>Retainer</th>
                <th>Ad Spend</th>
                <th>Portal</th>
                <th>Health</th>
                <th>Payment</th>
              </tr>
            </thead>
            <tbody>
              {clients.filter(c => c.status !== 'churned').map(c => (
                <tr key={c.id}>
                  <td>
                    <p className="text-text-primary font-medium">{c.company_name}</p>
                    <p className="text-xs text-text-tertiary">{c.contact_name}</p>
                  </td>
                  <td className="text-text-secondary">{c.package_tier}</td>
                  <td className="mono">£{Number(c.monthly_retainer || 0).toLocaleString()}</td>
                  <td className="mono">
                    {Number(c.ad_spend_managed || 0) > 0 ? `£${Number(c.ad_spend_managed).toLocaleString()}` : '—'}
                  </td>
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
                  <td>
                    <Badge variant={c.payment_status === 'paid' ? 'green' : c.payment_status === 'overdue' ? 'red' : 'amber'} dot>
                      {(c.payment_status || 'pending').charAt(0).toUpperCase() + (c.payment_status || 'pending').slice(1)}
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
