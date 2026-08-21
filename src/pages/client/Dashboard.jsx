import { useEffect, useState } from 'react'
import { AreaChart, Area, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts'
import { RefreshCw, TrendingUp, Users, PoundSterling, BarChart2, ArrowUpRight, ArrowDownRight, Repeat, UserCheck, Activity } from 'lucide-react'
import { Link } from 'react-router-dom'
import Modal from '../../components/ui/Modal'
import OnboardingChecklist from '../../components/ui/OnboardingChecklist'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { apiFetch } from '../../lib/api'
import { isRestrictedTier } from '../../data/packageTiers'

// Placeholder chart data shown when real data is empty
const PLACEHOLDER_TREND = [
  { month: 'Oct', leads: 18, revenue: 4200 },
  { month: 'Nov', leads: 24, revenue: 5800 },
  { month: 'Dec', leads: 21, revenue: 5100 },
  { month: 'Jan', leads: 31, revenue: 7400 },
  { month: 'Feb', leads: 28, revenue: 6900 },
  { month: 'Mar', leads: 38, revenue: 9200 },
]

function formatCurrency(value) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency', currency: 'GBP', maximumFractionDigits: 0,
  }).format(Number(value || 0))
}

function formatMonthLabel(dateLike) {
  const date = new Date(dateLike)
  if (Number.isNaN(date.getTime())) return 'Current'
  return date.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
}

function getInvoiceDate(invoice) {
  return invoice?.due_date || invoice?.paid_date || invoice?.created_at || null
}

// Merges ad_performance rows with the real month-by-month Stripe revenue
// map into one set of monthly buckets — the trend chart always prefers the
// real synced revenue for a given month, only falling back to a spend*ROAS
// estimate for months where no Stripe revenue has been recorded. Buckets are
// keyed off the union of both sources so a month with real revenue but no ad
// spend (or vice versa) still shows up.
function aggregatePerformanceRows(rows, revenueByMonth = {}) {
  const buckets = new Map()

  function ensureBucket(key, dateForLabel) {
    if (!buckets.has(key)) {
      buckets.set(key, {
        monthKey: key,
        month: dateForLabel.toLocaleDateString('en-GB', { month: 'short' }),
        sortKey: dateForLabel.getTime(),
        spend: 0, leads: 0, clicks: 0, impressions: 0, conversions: 0, roasWeighted: 0,
      })
    }
    return buckets.get(key)
  }

  for (const row of rows || []) {
    const rawDate = row.date || row.created_at
    const date = new Date(rawDate)
    if (Number.isNaN(date.getTime())) continue
    const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
    const bucket = ensureBucket(key, new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)))
    bucket.spend += Number(row.spend || 0)
    bucket.leads += Number(row.leads || 0)
    bucket.clicks += Number(row.clicks || 0)
    bucket.impressions += Number(row.impressions || 0)
    bucket.conversions += Number(row.conversions || 0)
    bucket.roasWeighted += Number(row.spend || 0) * Number(row.roas || 0)
  }

  for (const key of Object.keys(revenueByMonth || {})) {
    const [year, month] = key.split('-').map(Number)
    if (!year || !month) continue
    ensureBucket(key, new Date(Date.UTC(year, month - 1, 1)))
  }

  return [...buckets.values()]
    .sort((a, b) => a.sortKey - b.sortKey)
    .slice(-6)
    .map((row) => {
      const realRevenue = revenueByMonth?.[row.monthKey]
      const estimatedRevenue = row.spend ? Number(row.roasWeighted.toFixed(0)) : 0
      return {
        month: row.month,
        monthKey: row.monthKey,
        sortKey: row.sortKey,
        spend: row.spend,
        leads: row.leads,
        clicks: row.clicks,
        impressions: row.impressions,
        conversions: row.conversions,
        cpl: row.leads ? Math.round(row.spend / row.leads) : 0,
        ctr: row.impressions ? Number(((row.clicks / row.impressions) * 100).toFixed(2)) : 0,
        roas: row.spend ? Number((row.roasWeighted / row.spend).toFixed(1)) : 0,
        revenue: realRevenue !== undefined ? realRevenue : estimatedRevenue,
        hasRealRevenue: realRevenue !== undefined,
      }
    })
}

// Least-squares linear fit over {x, y} points — used to project revenue and
// ad spend forward from real monthly history. With fewer than 2 points there's
// no trend to fit, so the forecast just holds flat at the last known value.
function linearRegression(points) {
  const n = points.length
  if (n < 2) return { slope: 0, intercept: points[0]?.y || 0 }
  const sumX = points.reduce((s, p) => s + p.x, 0)
  const sumY = points.reduce((s, p) => s + p.y, 0)
  const sumXY = points.reduce((s, p) => s + p.x * p.y, 0)
  const sumXX = points.reduce((s, p) => s + p.x * p.x, 0)
  const denom = n * sumXX - sumX * sumX
  const slope = denom !== 0 ? (n * sumXY - sumX * sumY) / denom : 0
  const intercept = (sumY - slope * sumX) / n
  return { slope, intercept }
}

// Projects revenue and ad spend forward `monthsAhead` months from real
// monthly history using an independent linear trend for each series.
function buildForecast(monthlyRows, monthsAhead = 3) {
  const real = (monthlyRows || []).filter((row) => row.hasRealRevenue || row.spend > 0)
  if (real.length < 2) return []
  const revenuePoints = real.map((row, i) => ({ x: i, y: Number(row.revenue || 0) }))
  const spendPoints = real.map((row, i) => ({ x: i, y: Number(row.spend || 0) }))
  const revReg = linearRegression(revenuePoints)
  const spendReg = linearRegression(spendPoints)
  const lastDate = new Date(real[real.length - 1].sortKey)

  const forecast = []
  for (let i = 1; i <= monthsAhead; i++) {
    const x = real.length - 1 + i
    const forecastDate = new Date(Date.UTC(lastDate.getUTCFullYear(), lastDate.getUTCMonth() + i, 1))
    forecast.push({
      month: forecastDate.toLocaleDateString('en-GB', { month: 'short' }),
      sortKey: forecastDate.getTime(),
      revenueForecast: Math.max(0, Math.round(revReg.slope * x + revReg.intercept)),
      spendForecast: Math.max(0, Math.round(spendReg.slope * x + spendReg.intercept)),
    })
  }
  return forecast
}

function buildPlatformSplit(rows, fallbackSplit = []) {
  if (!rows?.length || rows[0]?.month) return fallbackSplit
  const latestRow = rows.reduce((latest, row) => {
    const candidate = new Date(row.date || row.created_at || 0).getTime()
    const current = new Date(latest?.date || latest?.created_at || 0).getTime()
    return candidate > current ? row : latest
  }, rows[0])
  const latestDate = new Date(latestRow.date || latestRow.created_at)
  const latestMonth = latestDate.getUTCMonth()
  const latestYear = latestDate.getUTCFullYear()
  const grouped = new Map()
  for (const row of rows) {
    const rowDate = new Date(row.date || row.created_at || 0)
    if (Number.isNaN(rowDate.getTime())) continue
    if (rowDate.getUTCMonth() !== latestMonth || rowDate.getUTCFullYear() !== latestYear) continue
    const name = row.platform ? row.platform.charAt(0).toUpperCase() + row.platform.slice(1) : 'Unknown'
    const existing = grouped.get(name) || { platform: name, spend: 0, leads: 0 }
    existing.spend += Number(row.spend || 0)
    existing.leads += Number(row.leads || 0)
    grouped.set(name, existing)
  }
  return [...grouped.values()].sort((a, b) => b.spend - a.spend)
}

function summarizeInvoices(invoices) {
  const empty = { periodLabel: 'Current cycle', totalRevenue: 0, collectedRevenue: 0, outstandingRevenue: 0, retainerRevenue: 0, commissionRevenue: 0, paidCount: 0, outstandingCount: 0 }
  if (!invoices?.length) return empty
  const dated = invoices.map((i) => ({ ...i, _date: getInvoiceDate(i) })).filter((i) => i._date).sort((a, b) => new Date(a._date) - new Date(b._date))
  if (!dated.length) return empty
  const latestDate = new Date(dated[dated.length - 1]._date)
  const month = latestDate.getUTCMonth()
  const year = latestDate.getUTCFullYear()
  const cycle = dated.filter((i) => {
    const d = new Date(i._date)
    return d.getUTCMonth() === month && d.getUTCFullYear() === year && i.status !== 'draft'
  })
  return {
    periodLabel: formatMonthLabel(latestDate),
    totalRevenue: cycle.reduce((s, i) => s + Number(i.amount || 0), 0),
    collectedRevenue: cycle.filter((i) => i.status === 'paid').reduce((s, i) => s + Number(i.amount || 0), 0),
    outstandingRevenue: cycle.filter((i) => i.status === 'sent' || i.status === 'overdue').reduce((s, i) => s + Number(i.amount || 0), 0),
    retainerRevenue: cycle.filter((i) => i.type === 'retainer').reduce((s, i) => s + Number(i.amount || 0), 0),
    commissionRevenue: cycle.filter((i) => i.type === 'commission').reduce((s, i) => s + Number(i.amount || 0), 0),
    paidCount: cycle.filter((i) => i.status === 'paid').length,
    outstandingCount: cycle.filter((i) => i.status === 'sent' || i.status === 'overdue').length,
  }
}

function buildDashboardMetrics({ performanceRows, invoices }) {
  const performance = performanceRows.length ? performanceRows : []
  const latest = performance[performance.length - 1] || { month: 'Current', spend: 0, leads: 0, clicks: 0, impressions: 0, conversions: 0, cpl: 0, ctr: 0, roas: 0, revenue: 0 }
  const invoiceSummary = summarizeInvoices(invoices)
  const platformSplit = buildPlatformSplit(performanceRows, [])
  const revenuePrimary = invoiceSummary.totalRevenue || invoiceSummary.collectedRevenue
  return {
    periodLabel: invoiceSummary.periodLabel,
    revenuePrimary,
    collectedRevenue: invoiceSummary.collectedRevenue,
    outstandingRevenue: invoiceSummary.outstandingRevenue,
    retainerRevenue: invoiceSummary.retainerRevenue,
    commissionRevenue: invoiceSummary.commissionRevenue,
    adSpend: latest.spend,
    leads: latest.leads,
    conversions: latest.conversions,
    cpl: latest.cpl,
    roas: latest.roas,
    closeRate: latest.leads ? Number(((latest.conversions / latest.leads) * 100).toFixed(1)) : 0,
    paidCount: invoiceSummary.paidCount,
    outstandingCount: invoiceSummary.outstandingCount,
    topPlatform: platformSplit[0] || null,
    platformSplit,
    performance,
  }
}

const CustomAreaTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-bg-elevated border border-white/[0.08] rounded px-3 py-2 text-xs shadow-elevated space-y-1">
      <p className="text-text-secondary">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="font-mono-data font-semibold" style={{ color: p.stroke }}>
          {p.name}: {p.name === 'Leads' ? p.value : formatCurrency(p.value)}
        </p>
      ))}
    </div>
  )
}

function TrendBadge({ value, suffix = '%' }) {
  if (!value) return null
  const up = value > 0
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${up ? 'text-status-success' : 'text-status-danger'}`}>
      {up ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
      {Math.abs(value)}{suffix}
    </span>
  )
}

export default function ClientDashboard() {
  const { profile } = useAuth()
  const [analysisModal, setAnalysisModal] = useState(null)
  const [dashboardLoading, setDashboardLoading] = useState(true)
  const [adPerformance, setAdPerformance] = useState([])
  const [invoiceRows, setInvoiceRows] = useState([])
  const [metaConnected, setMetaConnected] = useState(null)
  const [stripeRevenue, setStripeRevenue] = useState({ total: 0, last90: 0, byMonth: {}, activeSubscriptions: 0, mrr: 0, customerCount: 0 })
  const [syncing, setSyncing] = useState(false)
  const [syncMessage, setSyncMessage] = useState(null)
  const [manualCosts, setManualCosts] = useState({})
  const [costInput, setCostInput] = useState('')
  const [savingCost, setSavingCost] = useState(false)
  const [costMessage, setCostMessage] = useState(null)
  const [packageTier, setPackageTier] = useState(null)

  const clientId = profile?.client_id
  const currentMonthKey = new Date().toISOString().slice(0, 7)
  const restricted = isRestrictedTier(packageTier)

  useEffect(() => {
    if (!clientId) { setDashboardLoading(false); return }
    async function loadDashboardData() {
      setDashboardLoading(true)
      try {
        const [{ data: adData, error: adError }, { data: invoiceData, error: invoiceError }, { data: clientRow }] = await Promise.all([
          supabase.from('ad_performance').select('date, spend, leads, clicks, impressions, conversions, cpl, ctr, roas, platform, client_id').eq('client_id', clientId).order('date', { ascending: true }),
          supabase.from('invoices').select('id, amount, due_date, paid_date, created_at, status, type, client_id').eq('client_id', clientId).order('created_at', { ascending: false }),
          supabase.from('clients').select('meta_ad_account_id, stripe_total_revenue, stripe_revenue_last_90d, stripe_revenue_by_month, stripe_active_subscriptions, stripe_mrr, stripe_customer_count, manual_costs_by_month, package_tier').eq('id', clientId).maybeSingle(),
        ])
        if (adError) throw adError
        if (invoiceError) throw invoiceError
        setAdPerformance(adData || [])
        setInvoiceRows(invoiceData || [])
        setMetaConnected(Boolean(clientRow?.meta_ad_account_id))
        setPackageTier(clientRow?.package_tier || null)
        setStripeRevenue({
          total: Number(clientRow?.stripe_total_revenue || 0),
          last90: Number(clientRow?.stripe_revenue_last_90d || 0),
          byMonth: clientRow?.stripe_revenue_by_month || {},
          activeSubscriptions: Number(clientRow?.stripe_active_subscriptions || 0),
          mrr: Number(clientRow?.stripe_mrr || 0),
          customerCount: Number(clientRow?.stripe_customer_count || 0),
        })
        const costs = clientRow?.manual_costs_by_month || {}
        setManualCosts(costs)
        setCostInput(costs[currentMonthKey] !== undefined ? String(costs[currentMonthKey]) : '')
      } catch (error) {
        console.error('Failed to load client dashboard data:', error)
      } finally {
        setDashboardLoading(false)
      }
    }
    loadDashboardData()
  }, [clientId, currentMonthKey])

  async function handleSaveCost() {
    if (!clientId) return
    const numericAmount = Number(costInput)
    if (!Number.isFinite(numericAmount) || numericAmount < 0) {
      setCostMessage('Enter a valid amount')
      return
    }
    setSavingCost(true)
    setCostMessage(null)
    try {
      const res = await apiFetch('/api/stripe/save-manual-cost', {
        method: 'POST',
        body: JSON.stringify({ month: currentMonthKey, amount: numericAmount }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setManualCosts(data.manual_costs_by_month || {})
      setCostMessage('Saved')
    } catch (err) {
      setCostMessage(err.message || 'Save failed')
    } finally {
      setSavingCost(false)
    }
  }

  async function handleSyncMeta() {
    if (!clientId) return
    setSyncing(true)
    setSyncMessage(null)
    try {
      const res = await apiFetch('/api/meta/sync', { method: 'POST', body: JSON.stringify({ client_id: clientId }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setSyncMessage(`Synced ${data.rows_synced} entries`)
      const { data: adData } = await supabase.from('ad_performance').select('date, spend, leads, clicks, impressions, conversions, cpl, ctr, roas, platform, client_id').eq('client_id', clientId).order('date', { ascending: true })
      setAdPerformance(adData || [])
    } catch (err) {
      setSyncMessage(err.message || 'Sync failed')
    } finally {
      setSyncing(false)
    }
  }

  const metrics = buildDashboardMetrics({
    performanceRows: aggregatePerformanceRows(adPerformance, stripeRevenue.byMonth),
    invoices: invoiceRows,
  })

  const hasRealData = adPerformance.length > 0 || invoiceRows.length > 0 || stripeRevenue.total > 0
  const chartData = metrics.performance.length ? metrics.performance : PLACEHOLDER_TREND
  const isPlaceholder = !hasRealData

  const forecastRows = !isPlaceholder ? buildForecast(metrics.performance) : []
  const combinedChartData = isPlaceholder || !forecastRows.length
    ? chartData
    : (() => {
        const withNulls = chartData.map((row) => ({ ...row, revenueForecast: null, spendForecast: null }))
        const lastReal = withNulls[withNulls.length - 1]
        if (lastReal) {
          lastReal.revenueForecast = lastReal.revenue
          lastReal.spendForecast = lastReal.spend
        }
        return [...withNulls, ...forecastRows.map((row) => ({ ...row, revenue: null, spend: null, leads: null }))]
      })()

  const currentMonthCost = Number(manualCosts[currentMonthKey] || 0)
  const totalMonthlyCost = metrics.adSpend + currentMonthCost
  const cac = metrics.conversions > 0 ? totalMonthlyCost / metrics.conversions : 0

  const revenuePrimary = stripeRevenue.total > 0 ? stripeRevenue.total : metrics.revenuePrimary
  const revenueSub = stripeRevenue.total > 0
    ? `${formatCurrency(stripeRevenue.last90)} last 90 days`
    : (metrics.collectedRevenue > 0 ? `${formatCurrency(metrics.collectedRevenue)} collected` : null)

  const kpiCards = [
    { label: 'Total Revenue', value: formatCurrency(revenuePrimary), icon: PoundSterling, color: 'text-vc-accent', sub: revenueSub },
    ...(restricted ? [] : [
      { label: 'Ad Spend', value: formatCurrency(metrics.adSpend), icon: BarChart2, color: 'text-status-info', sub: metrics.roas > 0 ? `${metrics.roas.toFixed(1)}x ROAS` : null },
      { label: 'Leads', value: metrics.leads || '—', icon: Users, color: 'text-status-success', sub: metrics.cpl > 0 ? `${formatCurrency(metrics.cpl)} CPL` : null },
    ]),
    { label: 'Outstanding', value: formatCurrency(metrics.outstandingRevenue), icon: TrendingUp, color: metrics.outstandingRevenue > 0 ? 'text-status-warning' : 'text-text-tertiary', sub: metrics.outstandingCount > 0 ? `${metrics.outstandingCount} invoice${metrics.outstandingCount > 1 ? 's' : ''}` : null },
  ]

  const subscriptionCards = [
    { label: 'Active Subscriptions', value: stripeRevenue.activeSubscriptions || '—', icon: Repeat, color: 'text-vc-accent' },
    { label: 'MRR', value: formatCurrency(stripeRevenue.mrr), icon: Activity, color: 'text-status-info', sub: 'Monthly recurring revenue' },
    { label: 'Customers', value: stripeRevenue.customerCount || '—', icon: UserCheck, color: 'text-status-success' },
  ]
  const showSubscriptionCards = stripeRevenue.total > 0 || stripeRevenue.customerCount > 0 || stripeRevenue.activeSubscriptions > 0

  const nextMonthForecast = forecastRows[0] || null
  const forecastRoas = nextMonthForecast?.spendForecast > 0
    ? Number((nextMonthForecast.revenueForecast / nextMonthForecast.spendForecast).toFixed(1))
    : 0

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1440px] mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-h2 font-heading text-text-primary">
            Hello, {profile?.full_name?.split(' ')[0] ?? 'there'}
          </h1>
          <p className="text-text-secondary text-sm mt-1">
            {isPlaceholder ? 'Your data will appear here once your campaigns are live.' : `Revenue view for ${metrics.periodLabel}.`}
          </p>
        </div>
        {!restricted && metaConnected === true && (
          <button onClick={handleSyncMeta} disabled={syncing} className="flex items-center gap-1.5 text-xs text-text-secondary hover:text-text-primary disabled:opacity-50 transition-colors flex-shrink-0 mt-1">
            <RefreshCw size={12} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'Syncing…' : syncMessage ?? 'Sync now'}
          </button>
        )}
      </div>

      <OnboardingChecklist calendlyUrl="https://calendly.com/virtuecore" />

      {/* Meta matching status banner */}
      {!restricted && metaConnected === false && (
        <div className="vc-card flex items-center justify-between gap-4 border-status-info/20 bg-status-info/5">
          <div>
            <p className="text-sm font-medium text-status-info">Ads account not matched yet</p>
            <p className="text-xs text-text-secondary mt-0.5">Your account manager links your Ads Manager account on our side — no action needed from you. Live campaign data will appear here once it's matched.</p>
          </div>
          <Link to="/client/integrations" className="flex-shrink-0 bg-status-info/10 hover:bg-status-info/20 text-status-info border border-status-info/20 text-xs font-medium px-4 py-2 rounded-btn transition-colors">
            View status
          </Link>
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((card) => (
          <div key={card.label} className={`vc-card ${isPlaceholder ? 'opacity-40' : ''}`}>
            <div className="flex items-start justify-between gap-2 mb-3">
              <p className="vc-section-label">{card.label}</p>
              <div className="p-1.5 rounded bg-bg-tertiary flex-shrink-0">
                <card.icon size={14} className={card.color} />
              </div>
            </div>
            <p className="text-2xl font-mono-data font-semibold text-text-primary">{card.value}</p>
            {card.sub && <p className="text-xs text-text-tertiary mt-1">{card.sub}</p>}
          </div>
        ))}
      </div>

      {/* Subscriptions & customer accounts (from Stripe) */}
      {showSubscriptionCards && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {subscriptionCards.map((card) => (
            <div key={card.label} className="vc-card">
              <div className="flex items-start justify-between gap-2 mb-3">
                <p className="vc-section-label">{card.label}</p>
                <div className="p-1.5 rounded bg-bg-tertiary flex-shrink-0">
                  <card.icon size={14} className={card.color} />
                </div>
              </div>
              <p className="text-2xl font-mono-data font-semibold text-text-primary">{card.value}</p>
              {card.sub && <p className="text-xs text-text-tertiary mt-1">{card.sub}</p>}
            </div>
          ))}
        </div>
      )}

      {/* Trend chart */}
      <div className={`vc-card ${isPlaceholder ? 'relative' : ''}`}>
        <div className="flex items-center justify-between gap-4 mb-5">
          <div>
            <h2 className="text-sm font-semibold text-text-primary font-heading">Revenue & Lead Trend</h2>
            <p className="text-xs text-text-tertiary mt-0.5">
              {isPlaceholder ? 'Preview — example data shown until your campaigns are live' : 'Click chart for deeper analysis.'}
            </p>
          </div>
          {isPlaceholder && (
            <span className="text-[10px] font-medium text-text-tertiary bg-bg-tertiary border border-white/[0.06] rounded px-2 py-1">
              PREVIEW
            </span>
          )}
          {dashboardLoading && !isPlaceholder && (
            <span className="text-xs text-text-tertiary">Refreshing...</span>
          )}
        </div>
        <button
          type="button"
          onClick={() => !isPlaceholder && setAnalysisModal('trend')}
          className={`w-full ${!isPlaceholder ? 'cursor-pointer' : 'cursor-default'}`}
        >
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={combinedChartData}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6C5CE7" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6C5CE7" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="leadGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#A29BFE" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#A29BFE" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#5A5A5E' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#5A5A5E' }} axisLine={false} tickLine={false} width={40} />
              <Tooltip content={<CustomAreaTooltip />} />
              {!restricted && (
                <Area type="monotone" dataKey="leads" stroke="#A29BFE" strokeWidth={2} fill="url(#leadGrad)" dot={false} activeDot={{ r: 4, fill: '#A29BFE' }} name="Leads" isAnimationActive animationBegin={0} animationDuration={900} animationEasing="ease-out" />
              )}
              <Area type="monotone" dataKey="revenue" stroke="#6C5CE7" strokeWidth={2.5} fill="url(#revGrad)" dot={false} activeDot={{ r: 4, fill: '#6C5CE7' }} name="Revenue" isAnimationActive animationBegin={150} animationDuration={900} animationEasing="ease-out" />
              {forecastRows.length > 0 && (
                <Line type="monotone" dataKey="revenueForecast" stroke="#6C5CE7" strokeWidth={2} strokeDasharray="6 4" dot={false} activeDot={{ r: 4, fill: '#6C5CE7' }} name="Revenue Forecast" connectNulls isAnimationActive={false} />
              )}
            </AreaChart>
          </ResponsiveContainer>
        </button>
        {isPlaceholder && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none rounded-card">
            <div className="bg-bg-elevated/80 backdrop-blur-sm border border-white/[0.08] rounded-card px-4 py-2">
              <p className="text-xs text-text-secondary">Your live data will appear here</p>
            </div>
          </div>
        )}
      </div>

      {/* Revenue & ad spend forecast */}
      {nextMonthForecast && (
        <div className="vc-card">
          <div className="flex items-center justify-between gap-4 mb-5">
            <div>
              <h2 className="text-sm font-semibold text-text-primary font-heading flex items-center gap-1.5">
                <Activity size={14} className="text-vc-accent" />
                {restricted ? 'Revenue Forecast' : 'Revenue & Spend Forecast'}
              </h2>
              <p className="text-xs text-text-tertiary mt-0.5">
                Trend-based projection from your last {metrics.performance.length} months of real data — not a guarantee.
              </p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={combinedChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#5A5A5E' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#5A5A5E' }} axisLine={false} tickLine={false} width={40} />
              <Tooltip content={<CustomAreaTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="revenue" stroke="#6C5CE7" strokeWidth={2} dot={false} name="Revenue" connectNulls />
              <Line type="monotone" dataKey="revenueForecast" stroke="#6C5CE7" strokeWidth={2} strokeDasharray="6 4" dot={false} name="Revenue Forecast" connectNulls />
              {!restricted && (
                <>
                  <Line type="monotone" dataKey="spend" stroke="#4DA3FF" strokeWidth={2} dot={false} name="Ad Spend" connectNulls />
                  <Line type="monotone" dataKey="spendForecast" stroke="#4DA3FF" strokeWidth={2} strokeDasharray="6 4" dot={false} name="Ad Spend Forecast" connectNulls />
                </>
              )}
            </AreaChart>
          </ResponsiveContainer>
          <div className={`grid ${restricted ? 'grid-cols-1' : 'grid-cols-3'} gap-3 mt-4 pt-4 border-t border-white/[0.06]`}>
            <div>
              <p className="text-xs text-text-secondary">Next month revenue</p>
              <p className="text-lg font-semibold text-text-primary mt-0.5">{formatCurrency(nextMonthForecast.revenueForecast)}</p>
            </div>
            {!restricted && (
              <>
                <div>
                  <p className="text-xs text-text-secondary">Next month ad spend</p>
                  <p className="text-lg font-semibold text-text-primary mt-0.5">{formatCurrency(nextMonthForecast.spendForecast)}</p>
                </div>
                <div>
                  <p className="text-xs text-text-secondary">Projected ROAS</p>
                  <p className="text-lg font-semibold text-text-primary mt-0.5">{forecastRoas > 0 ? `${forecastRoas.toFixed(1)}x` : '—'}</p>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Cost & CAC */}
      {!restricted && (
      <div className="vc-card">
        <div className="mb-4">
          <h2 className="text-sm font-semibold text-text-primary font-heading">Monthly Cost & CAC</h2>
          <p className="text-xs text-text-tertiary mt-0.5">
            Add any monthly tool/subscription costs not visible in your ad accounts or Stripe — we'll factor them into your cost per acquisition.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <div>
            <p className="text-xs text-text-secondary">Ad spend this month</p>
            <p className="text-lg font-semibold text-text-primary mt-0.5">{formatCurrency(metrics.adSpend)}</p>
          </div>
          <div>
            <p className="text-xs text-text-secondary">Total monthly cost</p>
            <p className="text-lg font-semibold text-text-primary mt-0.5">{formatCurrency(totalMonthlyCost)}</p>
          </div>
          <div>
            <p className="text-xs text-text-secondary">CAC (cost per acquisition)</p>
            <p className="text-lg font-semibold text-text-primary mt-0.5">{cac > 0 ? formatCurrency(cac) : '—'}</p>
          </div>
        </div>
        <div className="flex items-end gap-2 pt-3 border-t border-white/[0.06]">
          <div className="flex-1 max-w-[220px]">
            <label className="text-xs text-text-secondary block mb-1">Your costs this month (£)</label>
            <input
              type="number"
              min="0"
              step="1"
              value={costInput}
              onChange={(e) => setCostInput(e.target.value)}
              placeholder="e.g. 250"
              className="bg-bg-tertiary border border-white/[0.08] rounded-btn px-3 py-2 w-full text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-vc-primary focus:ring-1 focus:ring-vc-primary"
            />
          </div>
          <button
            onClick={handleSaveCost}
            disabled={savingCost}
            className="bg-vc-primary hover:bg-vc-accent text-white text-sm px-4 py-2 rounded-btn disabled:opacity-60 transition-colors"
          >
            {savingCost ? 'Saving...' : 'Save'}
          </button>
          {costMessage && <span className="text-xs text-text-tertiary pb-2">{costMessage}</span>}
        </div>
      </div>
      )}

      {/* Quick links */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Deliverables', sub: 'Review work in progress', href: '/client/deliverables' },
          { label: 'Content Calendar', sub: 'See scheduled posts', href: '/client/calendar' },
          { label: 'Messages', sub: 'Check your conversations', href: '/client/messages' },
          { label: 'Invoices', sub: 'Review billing status', href: '/client/invoices' },
        ].map((item) => (
          <a key={item.href} href={item.href} className="vc-card hover:border-white/[0.14] transition-colors block group">
            <p className="text-sm font-medium text-text-primary group-hover:text-vc-accent transition-colors">{item.label}</p>
            <p className="text-xs text-text-tertiary mt-0.5">{item.sub}</p>
          </a>
        ))}
      </div>

      {/* Trend Analysis Modal */}
      <Modal isOpen={analysisModal === 'trend'} onClose={() => setAnalysisModal(null)} title="Trend Analysis" size="lg">
        <div className="space-y-5">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: 'Ad Spend', value: formatCurrency(metrics.adSpend) },
              { label: 'Leads', value: metrics.leads },
              { label: 'ROAS', value: `${metrics.roas.toFixed(1)}x` },
              { label: 'CPL', value: formatCurrency(metrics.cpl) },
            ].map((stat) => (
              <div key={stat.label} className="bg-bg-tertiary border border-white/[0.06] rounded-card p-4">
                <p className="vc-section-label">{stat.label}</p>
                <p className="text-xl font-semibold text-text-primary mt-2 font-mono-data">{stat.value}</p>
              </div>
            ))}
          </div>
          <p className="text-sm text-text-secondary leading-6">
            Momentum is positive: lead volume and revenue trend are moving in the right direction together. A light area to watch is efficiency drift; if spend grows faster than conversions for too long, CPL can rise. Right now you are still in a strong zone.
          </p>
        </div>
      </Modal>
    </div>
  )
}
