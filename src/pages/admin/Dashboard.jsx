import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TrendingUp, Users, DollarSign, Activity, AlertTriangle, Clock } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import StatCard from '../../components/ui/StatCard'
import Badge from '../../components/ui/Badge'
import { supabase } from '../../lib/supabase'
import { withPortalStatus } from '../../lib/clientUtils'
import { useAuth } from '../../context/AuthContext'

const HEALTH_BADGE = { green: 'green', amber: 'amber', red: 'red' }

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
  const navigate = useNavigate()
  const [clients, setClients] = useState([])
  const [pipelineLeads, setPipelineLeads] = useState([])

  const loadClients = useCallback(async () => {
    if (!supabase) return
    const [{ data: clientRows, error: clientError }, { data: profileRows, error: profileError }, { data: leads }] = await Promise.all([
      supabase.from('clients').select('id, status, company_name, contact_name, monthly_retainer, health_score, package_tier, created_at').order('created_at', { ascending: false }),
      supabase.from('profiles').select('client_id, created_at').not('client_id', 'is', null),
      supabase.from('pipeline_leads').select('id, score, stage').neq('stage', 'contract_signed'),
    ])
    if (!clientError && !profileError && clientRows) {
      setClients(withPortalStatus(clientRows, profileRows || []))
    }
    if (leads) setPipelineLeads(leads)
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
  const mrr = activeClients.reduce((sum, c) => sum + Number(c.monthly_retainer || 0), 0)
  const totalAdSpend = 0
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
        <StatCard label="Monthly Revenue" value={fmt(mrr)} icon={DollarSign} />
        <StatCard
          label="Active Clients"
          value={activeClients.length}
          sub={`${joinedClients.length} in portal · ${onboardingClients.length} onboarding`}
          icon={Users}
        />
        <StatCard label="Pipeline Leads" value={pipelineLeads.length} icon={TrendingUp} />
        <StatCard label="Ad Spend Managed" value={fmt(totalAdSpend)} icon={Activity} />
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
            <AreaChart data={[]} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
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
              <Area type="monotone" dataKey="mrr" stroke="#6C5CE7" strokeWidth={2} fill="url(#mrrGrad)" dot={false} activeDot={{ r: 4, fill: '#6C5CE7' }} isAnimationActive animationBegin={0} animationDuration={900} animationEasing="ease-out" />
            </AreaChart>
          </ResponsiveContainer>
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
