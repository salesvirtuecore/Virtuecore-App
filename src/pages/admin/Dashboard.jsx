import { useCallback, useEffect, useState } from 'react'
import { TrendingUp, Users, DollarSign, Activity } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
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

  return clientRows.map((client) => ({
    ...client,
    portal_joined: joinedByClientId.has(client.id),
  }))
}

function fmt(n) {
  return n >= 1000 ? `£${(n / 1000).toFixed(1)}k` : `£${n}`
}

export default function AdminDashboard() {
  const { profile } = useAuth()
  const m = DEMO_BUSINESS_METRICS
  const [clients, setClients] = useState(isDemoMode ? DEMO_CLIENTS : [])

  const loadClients = useCallback(async () => {
    if (isDemoMode || !supabase) return

    const [{ data: clientRows, error: clientError }, { data: profileRows, error: profileError }] = await Promise.all([
      supabase
        .from('clients')
        .select('*')
        .order('created_at', { ascending: false }),
      supabase
        .from('profiles')
        .select('client_id, created_at')
        .not('client_id', 'is', null),
    ])

    if (clientError || profileError) {
      setClients([])
    } else if (clientRows) {
      setClients(withPortalStatus(clientRows, profileRows || []))
    }
  }, [])

  useEffect(() => {
    loadClients()
  }, [loadClients])

  useEffect(() => {
    if (isDemoMode || !supabase) return undefined

    const channel = supabase
      .channel('admin-dashboard-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'clients' },
        () => loadClients()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles' },
        (payload) => {
          const nextClientId = payload?.new?.client_id
          const prevClientId = payload?.old?.client_id
          if (nextClientId || prevClientId) {
            loadClients()
          }
        }
      )
      .subscribe()

    const pollId = window.setInterval(() => {
      loadClients()
    }, 15000)

    const refreshOnFocus = () => loadClients()
    const refreshOnVisible = () => {
      if (document.visibilityState === 'visible') {
        loadClients()
      }
    }

    window.addEventListener('focus', refreshOnFocus)
    document.addEventListener('visibilitychange', refreshOnVisible)

    return () => {
      window.clearInterval(pollId)
      window.removeEventListener('focus', refreshOnFocus)
      document.removeEventListener('visibilitychange', refreshOnVisible)
      supabase.removeChannel(channel)
    }
  }, [loadClients])

  const activeClients = clients.filter((c) => c.status === 'active')
  const onboardingClients = clients.filter((c) => c.status === 'onboarding')
  const joinedClients = clients.filter((c) => c.portal_joined)

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-vc-text">
          Good morning, {profile?.full_name?.split(' ')[0] ?? 'Samuel'} 👋
        </h1>
        <p className="text-sm text-vc-muted mt-0.5">Here's your business overview for March 2026.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Monthly Recurring Revenue"
          value={fmt(m.mrr)}
          trend={m.mrr_change}
          icon={DollarSign}
        />
        <StatCard
          label="Active Clients"
          value={activeClients.length}
          sub={`${joinedClients.length} joined • ${onboardingClients.length} onboarding`}
          icon={Users}
        />
        <StatCard
          label="Pipeline Value"
          value={fmt(m.pipeline_value)}
          sub="5 active leads"
          icon={TrendingUp}
        />
        <StatCard
          label="Ad Spend Under Management"
          value={fmt(m.total_ad_spend)}
          trend={m.ad_spend_change}
          icon={Activity}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* MRR Chart */}
        <div className="lg:col-span-2 border border-vc-border p-5">
          <h2 className="text-sm font-medium text-vc-text mb-4">MRR Growth</h2>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={DEMO_MRR_CHART}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#666666' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#666666' }} axisLine={false} tickLine={false} tickFormatter={(v) => `£${v / 1000}k`} />
              <Tooltip formatter={(v) => [`£${v.toLocaleString()}`, 'MRR']} />
              <Line type="monotone" dataKey="mrr" stroke="#D4A843" strokeWidth={2} dot={{ r: 3, fill: '#D4A843' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Outstanding */}
        <div className="border border-vc-border p-5">
          <h2 className="text-sm font-medium text-vc-text mb-4">Attention Required</h2>
          <div className="space-y-3">
            <div className="flex items-start gap-3 py-2 border-b border-vc-border">
              <div className="w-2 h-2 rounded-full bg-red-500 mt-1.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-vc-text">Overdue invoice</p>
                <p className="text-xs text-vc-muted">Prestige Window Cleaning — £1,500</p>
              </div>
            </div>
            <div className="flex items-start gap-3 py-2 border-b border-vc-border">
              <div className="w-2 h-2 rounded-full bg-amber-500 mt-1.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-vc-text">3 pending deliverables</p>
                <p className="text-xs text-vc-muted">Prestige — awaiting VA completion</p>
              </div>
            </div>
            <div className="flex items-start gap-3 py-2">
              <div className="w-2 h-2 rounded-full bg-amber-500 mt-1.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-vc-text">Proposal follow-up</p>
                <p className="text-xs text-vc-muted">YC Financial — sent 3 days ago</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Client Health */}
      <div className="border border-vc-border">
        <div className="px-5 py-3 border-b border-vc-border flex items-center justify-between">
          <h2 className="text-sm font-medium text-vc-text">Client Health</h2>
          <span className="text-xs text-vc-muted">{activeClients.length} active</span>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-vc-border bg-vc-secondary">
              <th className="text-left px-5 py-2.5 text-xs text-vc-muted font-medium">Client</th>
              <th className="text-left px-5 py-2.5 text-xs text-vc-muted font-medium">Package</th>
              <th className="text-left px-5 py-2.5 text-xs text-vc-muted font-medium">Retainer</th>
              <th className="text-left px-5 py-2.5 text-xs text-vc-muted font-medium">Ad Spend</th>
              <th className="text-left px-5 py-2.5 text-xs text-vc-muted font-medium">Portal</th>
              <th className="text-left px-5 py-2.5 text-xs text-vc-muted font-medium">Health</th>
              <th className="text-left px-5 py-2.5 text-xs text-vc-muted font-medium">Payment</th>
            </tr>
          </thead>
          <tbody>
            {clients.filter((c) => c.status !== 'churned').map((c) => (
              <tr key={c.id} className="border-b border-vc-border last:border-0 hover:bg-vc-secondary transition-colors">
                <td className="px-5 py-3">
                  <p className="font-medium text-vc-text">{c.company_name}</p>
                  <p className="text-xs text-vc-muted">{c.contact_name}</p>
                </td>
                <td className="px-5 py-3 text-vc-muted">{c.package_tier}</td>
                <td className="px-5 py-3 text-vc-text">£{Number(c.monthly_retainer || 0).toLocaleString()}</td>
                <td className="px-5 py-3 text-vc-text">
                  {Number(c.ad_spend_managed || 0) > 0 ? `£${Number(c.ad_spend_managed).toLocaleString()}` : '—'}
                </td>
                <td className="px-5 py-3">
                  <Badge variant={PORTAL_BADGE[c.portal_joined ? 'joined' : 'invited']}>
                    {c.portal_joined ? 'Joined' : 'Invited'}
                  </Badge>
                </td>
                <td className="px-5 py-3">
                  <Badge variant={HEALTH_BADGE[c.health_score]}>
                    {c.health_score.charAt(0).toUpperCase() + c.health_score.slice(1)}
                  </Badge>
                </td>
                <td className="px-5 py-3">
                  <Badge variant={c.payment_status === 'paid' ? 'green' : c.payment_status === 'overdue' ? 'red' : 'amber'}>
                    {(c.payment_status || 'pending').charAt(0).toUpperCase() + (c.payment_status || 'pending').slice(1)}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
