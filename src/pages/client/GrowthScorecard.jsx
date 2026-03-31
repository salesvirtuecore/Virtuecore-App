import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { TrendingUp, TrendingDown, Award } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { DEMO_GROWTH_SCORECARD } from '../../data/placeholder'
import { format, parseISO } from 'date-fns'

function pctChange(start, now, lowerIsBetter) {
  if (!start || start === 0) return null
  const pct = Math.round(((now - start) / start) * 100)
  return { pct, isGood: lowerIsBetter ? pct < 0 : pct > 0 }
}

function MetricCard({ metric }) {
  const change = pctChange(metric.start, metric.now, metric.lower_is_better)
  const fmt = (v) => `${metric.prefix ? metric.unit : ''}${typeof v === 'number' && v > 100 ? v.toLocaleString() : v}${metric.suffix ? metric.unit : ''}`

  return (
    <div className="vc-card">
      <p className="vc-section-label mb-3">{metric.label}</p>
      <div className="flex items-end justify-between gap-2">
        <div>
          <p className="text-xs text-text-secondary mb-1">When you started</p>
          <p className="text-lg font-medium text-text-secondary">{metric.start === 0 ? '—' : fmt(metric.start)}</p>
        </div>
        <div className="text-text-secondary/30 text-lg font-light">→</div>
        <div className="text-right">
          <p className="text-xs text-text-secondary mb-1">Now</p>
          <p className="text-2xl font-bold text-text-primary">{fmt(metric.now)}</p>
        </div>
      </div>
      {change && (
        <div className={`mt-3 flex items-center gap-1.5 text-sm font-semibold ${change.isGood ? 'text-status-success' : 'text-status-danger'}`}>
          {change.isGood ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
          {change.isGood ? '+' : ''}{change.pct}% {change.isGood ? 'improvement' : 'change'}
        </div>
      )}
      {metric.start === 0 && (
        <div className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-status-success">
          <TrendingUp size={14} />
          +{metric.now} {metric.unit || 'total'}
        </div>
      )}
    </div>
  )
}

export default function GrowthScorecard() {
  const { profile, isDemo } = useAuth()
  const { pathname } = useLocation()
  const useDemo = isDemo || pathname.startsWith('/preview/')
  const [data, setData] = useState(useDemo ? DEMO_GROWTH_SCORECARD : null)
  const [loading, setLoading] = useState(!useDemo)
  const [activeChart, setActiveChart] = useState('leads')

  useEffect(() => {
    if (useDemo || !supabase || !profile?.client_id) return
    setLoading(true)
    supabase
      .from('ad_performance')
      .select('date,spend,leads,cpl,roas')
      .eq('client_id', profile.client_id)
      .order('date', { ascending: true })
      .then(({ data: rows }) => {
        if (!rows?.length) { setLoading(false); return }
        const byMonth = {}
        rows.forEach((r) => {
          const m = r.date.slice(0, 7)
          if (!byMonth[m]) byMonth[m] = []
          byMonth[m].push(r)
        })
        const months = Object.keys(byMonth).sort()
        const firstM = byMonth[months[0]] || []
        const lastM = byMonth[months[months.length - 1]] || []
        const avg = (arr, key) => arr.length ? arr.reduce((s, r) => s + Number(r[key] || 0), 0) / arr.length : 0
        const sum = (arr, key) => arr.reduce((s, r) => s + Number(r[key] || 0), 0)
        const monthly_leads = months.map((m) => ({
          month: format(parseISO(m + '-01'), 'MMM'),
          leads: Math.round(sum(byMonth[m], 'leads')),
          cpl: Math.round(avg(byMonth[m], 'cpl')),
        }))
        setData({
          client_since: rows[0].date,
          months_active: months.length,
          metrics: [
            { label: 'Cost Per Lead', start: Math.round(avg(firstM, 'cpl')), now: Math.round(avg(lastM, 'cpl')), unit: '£', prefix: true, lower_is_better: true },
            { label: 'Monthly Leads', start: Math.round(sum(firstM, 'leads')), now: Math.round(sum(lastM, 'leads')), unit: '', lower_is_better: false },
            { label: 'ROAS', start: parseFloat(avg(firstM, 'roas').toFixed(1)), now: parseFloat(avg(lastM, 'roas').toFixed(1)), unit: 'x', suffix: true, lower_is_better: false },
          ],
          monthly_leads,
          totals: {
            leads_generated: Math.round(sum(rows, 'leads')),
            ad_spend_managed: Math.round(sum(rows, 'spend')),
            estimated_pipeline: Math.round(sum(rows, 'leads') * 750),
            tasks_completed: 0,
          },
        })
        setLoading(false)
      })
  }, [profile?.client_id, useDemo])

  if (loading) return <div className="p-6 flex items-center justify-center h-64"><div className="w-5 h-5 border-2 border-white/[0.06] border-t-vc-primary rounded-full animate-spin" /></div>
  if (!data) return <div className="p-6 text-sm text-text-secondary">No data available yet. Your scorecard will populate as we start tracking results.</div>

  const chartData = data.monthly_leads || []
  const maxLeads = Math.max(...chartData.map((d) => d.leads), 1)
  const maxCpl = Math.max(...chartData.map((d) => d.cpl), 1)
  const chartMax = activeChart === 'leads' ? maxLeads : maxCpl

  return (
    <div className="p-4 md:p-6 space-y-5 w-full overflow-x-hidden">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-h2 font-heading text-text-primary">Growth Scorecard</h1>
            <Award size={16} className="text-vc-accent" />
          </div>
          <p className="text-sm text-text-secondary mt-0.5">
            Client since {data.client_since ? format(parseISO(data.client_since), 'MMMM yyyy') : '—'} · {data.months_active} months active · Updated monthly
          </p>
        </div>
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {data.metrics.map((m) => <MetricCard key={m.label} metric={m} />)}
      </div>

      {/* Monthly trend chart */}
      {chartData.length > 0 && (
        <div className="vc-card">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-medium text-text-primary">Monthly Progression</p>
            <div className="flex gap-1">
              {['leads', 'cpl'].map((k) => (
                <button
                  key={k}
                  onClick={() => setActiveChart(k)}
                  className={`text-xs px-3 py-1 border transition-colors ${activeChart === k ? 'bg-vc-primary text-white border-text-primary' : 'border-white/[0.06] text-text-secondary hover:text-text-primary'}`}
                >
                  {k === 'leads' ? 'Leads' : 'CPL'}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-end gap-2 h-32">
            {chartData.map((d, i) => {
              const val = activeChart === 'leads' ? d.leads : d.cpl
              const isLast = i === chartData.length - 1
              const pct = Math.max((val / chartMax) * 100, 2)
              const isImprovement = activeChart === 'leads'
                ? d.leads > (chartData[0]?.leads || 0)
                : d.cpl < (chartData[0]?.cpl || Infinity)
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[10px] text-text-secondary font-medium">{activeChart === 'leads' ? val : `£${val}`}</span>
                  <div className="w-full flex items-end justify-center">
                    <div
                      className={`w-full rounded-sm transition-all ${isLast ? 'bg-vc-primary' : isImprovement && i > 0 ? 'bg-status-success' : 'bg-vc-border'}`}
                      style={{ height: `${pct * 0.7}px` }}
                      title={`${d.month}: ${val}`}
                    />
                  </div>
                  <span className="text-[10px] text-text-secondary">{d.month}</span>
                </div>
              )
            })}
          </div>
          <p className="text-xs text-text-secondary mt-2 text-right">
            {activeChart === 'leads' ? '↑ Higher is better' : '↓ Lower is better (lower cost per lead)'}
          </p>
        </div>
      )}

      {/* Total impact */}
      <div className="vc-card bg-bg-tertiary">
        <p className="text-xs font-semibold uppercase tracking-wider text-text-secondary mb-3">Total Impact Since You Started</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-2xl font-bold text-text-primary">{data.totals.leads_generated.toLocaleString()}</p>
            <p className="text-xs text-text-secondary mt-0.5">Total leads generated</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-text-primary">£{data.totals.ad_spend_managed.toLocaleString()}</p>
            <p className="text-xs text-text-secondary mt-0.5">Ad spend managed</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-text-primary">£{data.totals.estimated_pipeline.toLocaleString()}</p>
            <p className="text-xs text-text-secondary mt-0.5">Estimated pipeline created</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-text-primary">{data.totals.tasks_completed || data.metrics.find(m => m.key === 'tasks')?.now || 47}</p>
            <p className="text-xs text-text-secondary mt-0.5">Tasks delegated</p>
          </div>
        </div>
      </div>
    </div>
  )
}
