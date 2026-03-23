import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { Info } from 'lucide-react'
import { supabase, isDemoMode } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { DEMO_CLIENT_METRICS } from '../../data/placeholder'

function pct(a, b) {
  if (!b) return 0
  return Math.round(((a - b) / b) * 100)
}

function DiffBadge({ value, inverted = false }) {
  if (!value && value !== 0) return null
  const isGood = inverted ? value < 0 : value > 0
  return (
    <span className={`text-sm font-semibold ${isGood ? 'text-green-600' : value === 0 ? 'text-vc-muted' : 'text-red-500'}`}>
      {value > 0 ? '+' : ''}{value}%
    </span>
  )
}

export default function ROICalculator() {
  const { profile } = useAuth()
  const { pathname } = useLocation()
  const useDemo = isDemoMode || pathname.startsWith('/preview/')

  const [base, setBase] = useState(null)
  const [loading, setLoading] = useState(true)
  const [proposedSpend, setProposedSpend] = useState(null)
  const [dealValue, setDealValue] = useState(750)
  const [closeRate, setCloseRate] = useState(20)

  useEffect(() => {
    if (useDemo) {
      const m = DEMO_CLIENT_METRICS
      setBase({ spend: m.ad_spend, cpl: m.cpl, leads: m.leads, roas: m.roas })
      setProposedSpend(Math.round(m.ad_spend * 1.3 / 100) * 100)
      setLoading(false)
      return
    }
    if (!supabase || !profile?.client_id) { setLoading(false); return }
    const monthAgo = new Date(); monthAgo.setDate(monthAgo.getDate() - 30)
    supabase
      .from('ad_performance')
      .select('spend,leads,cpl,roas')
      .eq('client_id', profile.client_id)
      .gte('date', monthAgo.toISOString().split('T')[0])
      .then(({ data: rows }) => {
        if (!rows?.length) { setLoading(false); return }
        const spend = rows.reduce((s, r) => s + Number(r.spend || 0), 0)
        const leads = rows.reduce((s, r) => s + Number(r.leads || 0), 0)
        const cpl = leads > 0 ? Math.round(spend / leads) : 0
        const roas = rows.reduce((s, r) => s + Number(r.roas || 0), 0) / rows.length
        setBase({ spend, leads, cpl, roas })
        setProposedSpend(Math.round(spend * 1.3 / 100) * 100)
        setLoading(false)
      })
  }, [profile?.client_id, useDemo])

  if (loading) return <div className="p-6 flex items-center justify-center h-64"><div className="w-5 h-5 border-2 border-vc-border border-t-gold rounded-full animate-spin" /></div>
  if (!base || !base.cpl) return (
    <div className="p-6 text-sm text-vc-muted">
      No ad data yet. Your ROI projections will populate once we have performance data to work from.
    </div>
  )

  if (proposedSpend === null) return null

  // Calculations
  const projLeads = base.cpl > 0 ? Math.round(proposedSpend / base.cpl) : 0
  const currPipeline = base.leads * dealValue
  const projPipeline = projLeads * dealValue
  const currRevenue = Math.round(currPipeline * (closeRate / 100))
  const projRevenue = Math.round(projPipeline * (closeRate / 100))
  const spendIncrease = proposedSpend - base.spend
  const revenueIncrease = projRevenue - currRevenue
  const roi = spendIncrease > 0 ? Math.round((revenueIncrease - spendIncrease) / spendIncrease * 100) : 0
  const leadPct = pct(projLeads, base.leads)
  const pipelinePct = pct(projPipeline, currPipeline)

  return (
    <div className="p-4 md:p-6 space-y-5 w-full overflow-x-hidden">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-vc-text">ROI Projections</h1>
        <p className="text-sm text-vc-muted mt-0.5">See how scaling your ad spend could grow your pipeline — based on your actual CPL</p>
      </div>

      {/* Current baseline */}
      <div className="border border-vc-border p-4 bg-vc-secondary">
        <p className="text-xs font-semibold uppercase tracking-wide text-vc-muted mb-3">Your Current Performance (last 30 days)</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div><p className="text-2xl font-bold text-vc-text">£{base.spend.toLocaleString()}</p><p className="text-xs text-vc-muted mt-0.5">Monthly spend</p></div>
          <div><p className="text-2xl font-bold text-vc-text">{base.leads}</p><p className="text-xs text-vc-muted mt-0.5">Monthly leads</p></div>
          <div><p className="text-2xl font-bold text-vc-text">£{base.cpl}</p><p className="text-xs text-vc-muted mt-0.5">Cost per lead</p></div>
          <div><p className="text-2xl font-bold text-vc-text">{Number(base.roas).toFixed(1)}x</p><p className="text-xs text-vc-muted mt-0.5">ROAS</p></div>
        </div>
      </div>

      {/* Assumptions */}
      <div className="border border-vc-border p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-vc-muted mb-4">Projection Assumptions</p>
        <div className="space-y-5">
          {/* Spend slider */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-medium text-vc-text">Proposed monthly ad spend</label>
              <span className="text-sm font-bold text-vc-text">£{proposedSpend.toLocaleString()}</span>
            </div>
            <input
              type="range"
              min={500}
              max={30000}
              step={100}
              value={proposedSpend}
              onChange={(e) => setProposedSpend(Number(e.target.value))}
              className="w-full accent-gold"
            />
            <div className="flex justify-between text-xs text-vc-muted mt-0.5">
              <span>£500</span>
              <span className="text-vc-muted/60">Current: £{base.spend.toLocaleString()}</span>
              <span>£30,000</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-vc-text mb-1.5">
                Average deal value <span className="text-vc-muted font-normal">(£)</span>
              </label>
              <div className="flex items-center gap-1">
                <span className="text-sm text-vc-muted border border-vc-border px-2 py-2 bg-vc-secondary">£</span>
                <input
                  type="number"
                  value={dealValue}
                  onChange={(e) => setDealValue(Math.max(1, Number(e.target.value)))}
                  className="border border-vc-border px-3 py-2 text-sm w-full focus:outline-none focus:border-vc-text"
                />
              </div>
              <p className="text-xs text-vc-muted mt-1 flex items-center gap-1"><Info size={10} /> Typical for UK trades: £500–£2,000</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-vc-text mb-1.5">
                Lead close rate <span className="text-vc-muted font-normal">(%)</span>
              </label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={closeRate}
                  onChange={(e) => setCloseRate(Math.min(100, Math.max(1, Number(e.target.value))))}
                  className="border border-vc-border px-3 py-2 text-sm w-full focus:outline-none focus:border-vc-text"
                />
                <span className="text-sm text-vc-muted border border-vc-border px-2 py-2 bg-vc-secondary">%</span>
              </div>
              <p className="text-xs text-vc-muted mt-1 flex items-center gap-1"><Info size={10} /> Industry avg for local trades: 15–30%</p>
            </div>
          </div>
        </div>
      </div>

      {/* Projections */}
      <div className="border border-vc-border">
        <div className="px-4 py-3 border-b border-vc-border">
          <p className="text-sm font-medium text-vc-text">Projected Results</p>
          <p className="text-xs text-vc-muted">Based on your current CPL of £{base.cpl} — assumes same efficiency at scale</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-vc-border">
          {/* Leads */}
          <div className="p-5">
            <p className="text-xs text-vc-muted font-medium uppercase tracking-wide mb-2">Monthly Leads</p>
            <div className="flex items-end justify-between mb-1">
              <div>
                <span className="text-xs text-vc-muted">Now</span>
                <p className="text-xl font-semibold text-vc-text">{base.leads}</p>
              </div>
              <div className="text-vc-muted text-lg px-2">→</div>
              <div className="text-right">
                <span className="text-xs text-vc-muted">Projected</span>
                <p className="text-3xl font-bold text-vc-text">{projLeads}</p>
              </div>
            </div>
            <DiffBadge value={leadPct} />
            {/* Mini bar */}
            <div className="mt-2 flex gap-1 items-end h-6">
              <div className="bg-vc-border flex-shrink-0" style={{ width: '40%', height: `${Math.min((base.leads / Math.max(projLeads, base.leads)) * 100, 100)}%` }} />
              <div className="bg-gold flex-shrink-0" style={{ width: '40%', height: '100%' }} />
            </div>
          </div>
          {/* Pipeline */}
          <div className="p-5">
            <p className="text-xs text-vc-muted font-medium uppercase tracking-wide mb-2">Pipeline Value</p>
            <div className="flex items-end justify-between mb-1">
              <div>
                <span className="text-xs text-vc-muted">Now</span>
                <p className="text-xl font-semibold text-vc-text">£{currPipeline.toLocaleString()}</p>
              </div>
              <div className="text-vc-muted text-lg px-2">→</div>
              <div className="text-right">
                <span className="text-xs text-vc-muted">Projected</span>
                <p className="text-3xl font-bold text-vc-text">£{projPipeline.toLocaleString()}</p>
              </div>
            </div>
            <DiffBadge value={pipelinePct} />
            <p className="text-xs text-vc-muted mt-1">+£{(projPipeline - currPipeline).toLocaleString()} pipeline uplift</p>
          </div>
          {/* Revenue */}
          <div className="p-5">
            <p className="text-xs text-vc-muted font-medium uppercase tracking-wide mb-2">Est. Closed Revenue</p>
            <div className="flex items-end justify-between mb-1">
              <div>
                <span className="text-xs text-vc-muted">Now</span>
                <p className="text-xl font-semibold text-vc-text">£{currRevenue.toLocaleString()}</p>
              </div>
              <div className="text-vc-muted text-lg px-2">→</div>
              <div className="text-right">
                <span className="text-xs text-vc-muted">Projected</span>
                <p className="text-3xl font-bold text-vc-text">£{projRevenue.toLocaleString()}</p>
              </div>
            </div>
            <DiffBadge value={pct(projRevenue, currRevenue)} />
            <p className="text-xs text-vc-muted mt-1">at {closeRate}% close rate</p>
          </div>
        </div>
      </div>

      {/* ROI on incremental spend */}
      {spendIncrease > 0 && (
        <div className={`border p-5 ${roi > 0 ? 'border-green-200 bg-green-50/30' : 'border-vc-border'}`}>
          <div className="flex items-start gap-4 flex-wrap">
            <div>
              <p className="text-xs text-vc-muted font-medium uppercase tracking-wide mb-1">ROI on Extra Spend</p>
              <p className="text-4xl font-bold text-vc-text">{roi}%</p>
              <p className="text-xs text-vc-muted mt-1">
                Every extra £1 invested generates £{(1 + roi / 100).toFixed(2)} in closed revenue
              </p>
            </div>
            <div className="border-l border-vc-border pl-4 ml-auto">
              <div className="space-y-1 text-sm">
                <div className="flex gap-8 justify-between"><span className="text-vc-muted">Extra spend:</span><span className="font-medium text-vc-text">£{spendIncrease.toLocaleString()}</span></div>
                <div className="flex gap-8 justify-between"><span className="text-vc-muted">Revenue increase:</span><span className="font-medium text-vc-text">£{revenueIncrease.toLocaleString()}</span></div>
                <div className="flex gap-8 justify-between border-t border-vc-border pt-1 mt-1"><span className="text-vc-muted">Net return:</span><span className={`font-bold ${revenueIncrease > spendIncrease ? 'text-green-600' : 'text-vc-text'}`}>£{(revenueIncrease - spendIncrease).toLocaleString()}</span></div>
              </div>
            </div>
          </div>
          <p className="text-xs text-vc-muted mt-3 flex items-start gap-1.5">
            <Info size={10} className="flex-shrink-0 mt-0.5" />
            Projections assume your current CPL holds at scale. Actual results may vary based on audience saturation, creative performance, and seasonal factors.
          </p>
        </div>
      )}
    </div>
  )
}
