import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { TrendingUp, TrendingDown, Zap, Activity, Target, ChevronDown, ChevronUp } from 'lucide-react'
import Badge from '../../components/ui/Badge'
import { supabase, isDemoMode } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { DEMO_AD_FEED } from '../../data/placeholder'
import { format, parseISO } from 'date-fns'

const PLATFORM_COLOR = { Meta: '#1877F2', Google: '#34A853', TikTok: '#000000' }

function Trend({ value, unit = '', inverted = false }) {
  if (value == null || value === 0) return <span className="text-xs text-text-secondary">—</span>
  const isGood = inverted ? value < 0 : value > 0
  const Icon = value > 0 ? TrendingUp : TrendingDown
  return (
    <span className={`flex items-center gap-0.5 text-xs font-medium ${isGood ? 'text-status-success' : 'text-status-danger'}`}>
      <Icon size={11} />
      {Math.abs(value)}{unit}%
    </span>
  )
}

function StatCard({ label, value, sub }) {
  return (
    <div className="vc-card">
      <p className="vc-section-label mb-1">{label}</p>
      <p className="text-2xl font-semibold text-text-primary">{value}</p>
      {sub && <p className="text-xs text-text-secondary mt-0.5">{sub}</p>}
    </div>
  )
}

export default function AdPerformance() {
  const { profile } = useAuth()
  const { pathname } = useLocation()
  const useDemo = isDemoMode || pathname.startsWith('/preview/')
  const [data, setData] = useState(useDemo ? DEMO_AD_FEED : null)
  const [loading, setLoading] = useState(!useDemo)
  const [expandedTest, setExpandedTest] = useState(null)

  useEffect(() => {
    if (useDemo || !supabase || !profile?.client_id) return
    setLoading(true)
    const now = new Date()
    const weekAgo = new Date(now); weekAgo.setDate(now.getDate() - 7)
    supabase
      .from('ad_performance')
      .select('*')
      .eq('client_id', profile.client_id)
      .gte('date', weekAgo.toISOString().split('T')[0])
      .order('date', { ascending: false })
      .then(({ data: rows }) => {
        if (!rows?.length) { setLoading(false); return }
        const spend = rows.reduce((s, r) => s + Number(r.spend || 0), 0)
        const leads = rows.reduce((s, r) => s + Number(r.leads || 0), 0)
        const impressions = rows.reduce((s, r) => s + Number(r.impressions || 0), 0)
        const clicks = rows.reduce((s, r) => s + Number(r.clicks || 0), 0)
        setData({
          last_updated: new Date().toISOString(),
          week_summary: { spend, leads, cpl: leads > 0 ? Math.round(spend / leads) : 0, roas: rows.reduce((s, r) => s + Number(r.roas || 0), 0) / rows.length, impressions, clicks },
          daily_feed: rows.map((r) => ({ date: r.date, spend: Number(r.spend), leads: Number(r.leads), cpl: Number(r.cpl || 0), impressions: Number(r.impressions || 0), ctr: Number(r.ctr || 0) })),
          ab_tests: [],
          campaigns: [],
          winning_ad: null,
        })
        setLoading(false)
      })
  }, [profile?.client_id, useDemo])

  if (loading) return <div className="p-6 flex items-center justify-center h-64"><div className="w-5 h-5 border-2 border-white/[0.06] border-t-vc-primary rounded-full animate-spin" /></div>
  if (!data) return <div className="p-6 text-sm text-text-secondary">No ad performance data yet. Connect your ad account to see live data here.</div>

  const s = data.week_summary
  const maxLeads = Math.max(...(data.daily_feed?.map((d) => d.leads) || [1]), 1)

  return (
    <div className="p-4 md:p-6 space-y-5 w-full overflow-x-hidden">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-h2 font-heading text-text-primary">Live Ad Performance</h1>
            <span className="flex items-center gap-1 text-xs bg-status-success/10 text-status-success border border-status-success/20 px-2 py-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-status-success/100 animate-pulse" />
              Live
            </span>
          </div>
          <p className="text-sm text-text-secondary mt-0.5">
            Updated {data.last_updated ? format(parseISO(data.last_updated), 'd MMM yyyy, HH:mm') : 'today'} · Last 7 days
          </p>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Ad Spend" value={`£${s.spend.toLocaleString()}`} sub="this week" />
        <StatCard label="Leads" value={s.leads} sub="this week" />
        <StatCard label="Cost Per Lead" value={s.cpl > 0 ? `£${s.cpl}` : '—'} sub="avg CPL" />
        <StatCard label="ROAS" value={s.roas > 0 ? `${Number(s.roas).toFixed(1)}x` : '—'} sub="return on spend" />
      </div>

      {/* What's winning */}
      {data.winning_ad && (
        <div className="border border-vc-primary/30 bg-status-warning/10/50 p-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-vc-primary flex items-center justify-center flex-shrink-0">
              <Zap size={14} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-vc-accent mb-0.5">What's Winning Right Now</p>
              <p className="text-sm font-medium text-text-primary">{data.winning_ad.name}</p>
              <div className="flex items-center gap-4 mt-1 flex-wrap">
                <span className="text-xs text-text-secondary">{data.winning_ad.platform}</span>
                <span className="text-xs text-text-primary font-medium">£{data.winning_ad.cpl} CPL</span>
                <span className="text-xs text-status-success font-medium">
                  {Math.abs(data.winning_ad.vs_avg_pct)}% below average CPL
                </span>
                <span className="text-xs text-text-secondary">{data.winning_ad.leads} leads · £{data.winning_ad.spend?.toLocaleString()} spent</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* A/B Tests */}
      {data.ab_tests?.length > 0 && (
        <div className="border border-white/[0.06]">
          <div className="px-4 py-3 border-b border-white/[0.06]">
            <p className="text-sm font-medium text-text-primary">A/B Tests Running</p>
          </div>
          {data.ab_tests.map((test) => {
            const open = expandedTest === test.id
            const aDiff = test.variant_b.cpl > 0 ? Math.round((test.variant_b.cpl - test.variant_a.cpl) / test.variant_b.cpl * 100) : 0
            return (
              <div key={test.id} className="border-t border-white/[0.06] first:border-0">
                <button
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-bg-tertiary transition-colors text-left"
                  onClick={() => setExpandedTest(open ? null : test.id)}
                >
                  <div>
                    <span className="text-sm font-medium text-text-primary">{test.test_name}</span>
                    <span className="ml-2 text-xs text-text-secondary">{test.platform} · Day {test.days_running}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    {test.winner && (
                      <span className="text-xs bg-status-success/10 text-status-success border border-status-success/20 px-2 py-0.5 font-medium">
                        Hook {test.winner.toUpperCase()} winning by {Math.abs(aDiff)}%
                      </span>
                    )}
                    {open ? <ChevronUp size={14} className="text-text-secondary" /> : <ChevronDown size={14} className="text-text-secondary" />}
                  </div>
                </button>
                {open && (
                  <div className="px-4 pb-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                    {[test.variant_a, test.variant_b].map((v, i) => {
                      const isWinner = (i === 0 && test.winner === 'a') || (i === 1 && test.winner === 'b')
                      return (
                        <div key={i} className={`border p-4 ${isWinner ? 'border-status-success/30 bg-status-success/10/30' : 'border-white/[0.06]'}`}>
                          <div className="flex items-center gap-2 mb-3">
                            <span className="text-xs font-bold text-text-secondary uppercase">Hook {i === 0 ? 'A' : 'B'}</span>
                            {isWinner && <span className="text-xs bg-status-success/10 text-status-success px-1.5 py-0.5 font-medium">Leading</span>}
                          </div>
                          <p className="text-sm text-text-primary font-medium mb-3">{v.name}</p>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div><p className="text-text-secondary">CPL</p><p className="font-semibold text-text-primary">£{v.cpl}</p></div>
                            <div><p className="text-text-secondary">Leads</p><p className="font-semibold text-text-primary">{v.leads}</p></div>
                            <div><p className="text-text-secondary">Spend</p><p className="font-semibold text-text-primary">£{v.spend}</p></div>
                            <div><p className="text-text-secondary">CTR</p><p className="font-semibold text-text-primary">{v.ctr}%</p></div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Active Campaigns */}
      {data.campaigns?.length > 0 && (
        <div className="border border-white/[0.06]">
          <div className="px-4 py-3 border-b border-white/[0.06] flex items-center gap-2">
            <Target size={14} className="text-text-secondary" />
            <p className="text-sm font-medium text-text-primary">Active Campaigns</p>
          </div>
          <div className="divide-y divide-white/[0.06]">
            {data.campaigns.map((c, i) => (
              <div key={i} className="px-4 py-3 flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: PLATFORM_COLOR[c.platform] ?? '#888' }} />
                  <div className="min-w-0">
                    <p className="text-sm text-text-primary font-medium truncate">{c.name}</p>
                    <p className="text-xs text-text-secondary">{c.platform} · £{c.daily_budget}/day budget</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-xs flex-shrink-0">
                  <div className="text-right">
                    <p className="text-text-secondary">Today spend</p>
                    <p className="font-medium text-text-primary">£{c.spend_today}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-text-secondary">Leads today</p>
                    <p className="font-medium text-text-primary">{c.leads_today}</p>
                  </div>
                  <Badge variant={c.status === 'active' ? 'green' : c.status === 'testing' ? 'blue' : 'default'} size="xs">
                    {c.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Daily performance feed */}
      {data.daily_feed?.length > 0 && (
        <div className="border border-white/[0.06]">
          <div className="px-4 py-3 border-b border-white/[0.06] flex items-center gap-2">
            <Activity size={14} className="text-text-secondary" />
            <p className="text-sm font-medium text-text-primary">Daily Performance Feed</p>
          </div>

          {/* Mini bar chart */}
          <div className="px-4 pt-3 pb-1">
            <p className="text-xs text-text-secondary mb-2">Leads per day</p>
            <div className="flex items-end gap-1.5 h-12">
              {[...data.daily_feed].reverse().map((d, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                  <div
                    className="w-full bg-vc-primary/80 rounded-sm transition-all"
                    style={{ height: `${Math.max((d.leads / maxLeads) * 40, d.leads > 0 ? 4 : 2)}px` }}
                    title={`${d.date}: ${d.leads} leads`}
                  />
                  <span className="text-[9px] text-text-secondary hidden md:block">
                    {format(parseISO(d.date), 'd/M')}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[400px]">
              <thead>
                <tr className="border-t border-white/[0.06]">
                  <th className="text-left px-4 py-2 text-text-secondary font-medium">Date</th>
                  <th className="text-right px-4 py-2 text-text-secondary font-medium">Spend</th>
                  <th className="text-right px-4 py-2 text-text-secondary font-medium">Leads</th>
                  <th className="text-right px-4 py-2 text-text-secondary font-medium">CPL</th>
                  <th className="text-right px-4 py-2 text-text-secondary font-medium">CTR</th>
                </tr>
              </thead>
              <tbody>
                {data.daily_feed.map((d, i) => {
                  const prev = data.daily_feed[i + 1]
                  const cplChange = prev?.cpl > 0 && d.cpl > 0 ? Math.round((d.cpl - prev.cpl) / prev.cpl * 100) : null
                  return (
                    <tr key={d.date} className="border-t border-white/[0.06] hover:bg-bg-tertiary transition-colors">
                      <td className="px-4 py-2.5 text-text-primary font-medium">{format(parseISO(d.date), 'EEE d MMM')}</td>
                      <td className="px-4 py-2.5 text-right text-text-primary">£{d.spend}</td>
                      <td className="px-4 py-2.5 text-right">
                        <span className="text-text-primary font-medium">{d.leads}</span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <span className={d.cpl > 0 ? 'text-text-primary' : 'text-text-secondary'}>{d.cpl > 0 ? `£${d.cpl}` : '—'}</span>
                          {cplChange !== null && <Trend value={cplChange} inverted />}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-right text-text-secondary">{d.ctr ? `${d.ctr}%` : '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
