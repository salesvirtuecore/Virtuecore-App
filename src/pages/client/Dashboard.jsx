import { useEffect, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell } from 'recharts'
import { RefreshCw } from 'lucide-react'
import { Link } from 'react-router-dom'
import Modal from '../../components/ui/Modal'
import OnboardingChecklist from '../../components/ui/OnboardingChecklist'
import { DEMO_AD_PERFORMANCE, DEMO_CLIENT_METRICS, DEMO_INVOICES } from '../../data/placeholder'
import { useAuth } from '../../context/AuthContext'
import { supabase, isDemoMode } from '../../lib/supabase'

const DEMO_CLIENT_ID = 'c-001'

function formatCurrency(value) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0,
  }).format(Number(value || 0))
}

function formatPercent(value, digits = 1) {
  return `${Number(value || 0).toFixed(digits)}%`
}

function formatMonthLabel(dateLike) {
  const date = new Date(dateLike)
  if (Number.isNaN(date.getTime())) return 'Current'
  return date.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
}

function getInvoiceDate(invoice) {
  return invoice?.due_date || invoice?.paid_date || invoice?.created_at || null
}

function aggregatePerformanceRows(rows) {
  if (!rows?.length) return []

  if (rows[0]?.month) {
    return rows.map((row, index) => ({
      month: row.month,
      sortKey: index,
      spend: Number(row.spend || 0),
      leads: Number(row.leads || 0),
      clicks: Number(row.clicks || 0),
      impressions: Number(row.impressions || 0),
      conversions: Number(row.conversions || 0),
      cpl: Number(row.cpl || 0),
      ctr: Number(row.ctr || 0),
      roas: Number(row.roas || 0),
      revenueEstimate: Number(row.spend || 0) * Number(row.roas || 0),
    }))
  }

  const buckets = new Map()

  for (const row of rows) {
    const rawDate = row.date || row.created_at
    const date = new Date(rawDate)
    if (Number.isNaN(date.getTime())) continue

    const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
    const existing = buckets.get(key) || {
      month: date.toLocaleDateString('en-GB', { month: 'short' }),
      sortKey: Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1),
      spend: 0,
      leads: 0,
      clicks: 0,
      impressions: 0,
      conversions: 0,
      roasWeighted: 0,
    }

    existing.spend += Number(row.spend || 0)
    existing.leads += Number(row.leads || 0)
    existing.clicks += Number(row.clicks || 0)
    existing.impressions += Number(row.impressions || 0)
    existing.conversions += Number(row.conversions || 0)
    existing.roasWeighted += Number(row.spend || 0) * Number(row.roas || 0)
    buckets.set(key, existing)
  }

  return [...buckets.values()]
    .sort((left, right) => left.sortKey - right.sortKey)
    .slice(-6)
    .map((row) => ({
      ...row,
      cpl: row.leads ? Math.round(row.spend / row.leads) : 0,
      ctr: row.impressions ? Number(((row.clicks / row.impressions) * 100).toFixed(2)) : 0,
      roas: row.spend ? Number((row.roasWeighted / row.spend).toFixed(1)) : 0,
      revenueEstimate: row.spend ? Number(row.roasWeighted.toFixed(0)) : 0,
    }))
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

    const platformName = row.platform ? row.platform.charAt(0).toUpperCase() + row.platform.slice(1) : 'Unknown'
    const existing = grouped.get(platformName) || { platform: platformName, spend: 0, leads: 0 }
    existing.spend += Number(row.spend || 0)
    existing.leads += Number(row.leads || 0)
    grouped.set(platformName, existing)
  }

  return [...grouped.values()].sort((left, right) => right.spend - left.spend)
}

function summarizeInvoices(invoices) {
  if (!invoices?.length) {
    return {
      periodLabel: 'Current cycle',
      totalRevenue: 0,
      collectedRevenue: 0,
      outstandingRevenue: 0,
      retainerRevenue: 0,
      commissionRevenue: 0,
      paidCount: 0,
      outstandingCount: 0,
    }
  }

  const datedInvoices = invoices
    .map((invoice) => ({ ...invoice, _date: getInvoiceDate(invoice) }))
    .filter((invoice) => invoice._date)
    .sort((left, right) => new Date(left._date) - new Date(right._date))

  if (!datedInvoices.length) {
    return {
      periodLabel: 'Current cycle',
      totalRevenue: 0,
      collectedRevenue: 0,
      outstandingRevenue: 0,
      retainerRevenue: 0,
      commissionRevenue: 0,
      paidCount: 0,
      outstandingCount: 0,
    }
  }

  const latestDate = new Date(datedInvoices[datedInvoices.length - 1]._date)
  const month = latestDate.getUTCMonth()
  const year = latestDate.getUTCFullYear()
  const currentCycle = datedInvoices.filter((invoice) => {
    const invoiceDate = new Date(invoice._date)
    return invoiceDate.getUTCMonth() === month && invoiceDate.getUTCFullYear() === year && invoice.status !== 'draft'
  })

  return {
    periodLabel: formatMonthLabel(latestDate),
    totalRevenue: currentCycle.reduce((sum, invoice) => sum + Number(invoice.amount || 0), 0),
    collectedRevenue: currentCycle
      .filter((invoice) => invoice.status === 'paid')
      .reduce((sum, invoice) => sum + Number(invoice.amount || 0), 0),
    outstandingRevenue: currentCycle
      .filter((invoice) => invoice.status === 'sent' || invoice.status === 'overdue')
      .reduce((sum, invoice) => sum + Number(invoice.amount || 0), 0),
    retainerRevenue: currentCycle
      .filter((invoice) => invoice.type === 'retainer')
      .reduce((sum, invoice) => sum + Number(invoice.amount || 0), 0),
    commissionRevenue: currentCycle
      .filter((invoice) => invoice.type === 'commission')
      .reduce((sum, invoice) => sum + Number(invoice.amount || 0), 0),
    paidCount: currentCycle.filter((invoice) => invoice.status === 'paid').length,
    outstandingCount: currentCycle.filter((invoice) => invoice.status === 'sent' || invoice.status === 'overdue').length,
  }
}

function buildDashboardMetrics({ performanceRows, invoices, fallbackMetrics, useFallback }) {
  const performance = performanceRows.length ? performanceRows : useFallback ? aggregatePerformanceRows(DEMO_AD_PERFORMANCE) : []
  const latestPerformance = performance[performance.length - 1] || {
    month: 'Current',
    spend: 0,
    leads: 0,
    clicks: 0,
    impressions: 0,
    conversions: 0,
    cpl: 0,
    ctr: 0,
    roas: 0,
    revenueEstimate: 0,
  }

  const invoiceSummary = summarizeInvoices(
    invoices.length ? invoices : useFallback ? DEMO_INVOICES.filter((invoice) => invoice.client_id === DEMO_CLIENT_ID) : []
  )
  const platformSplit = buildPlatformSplit(performanceRows, useFallback ? fallbackMetrics.platform_split : [])
  const revenuePrimary = invoiceSummary.totalRevenue || (useFallback ? latestPerformance.revenueEstimate : invoiceSummary.collectedRevenue)
  const closeRate = latestPerformance.leads
    ? Number(((latestPerformance.conversions / latestPerformance.leads) * 100).toFixed(1))
    : 0
  const revenuePerLead = latestPerformance.leads ? revenuePrimary / latestPerformance.leads : 0
  const costPerSale = latestPerformance.conversions ? latestPerformance.spend / latestPerformance.conversions : 0
  const topPlatform = platformSplit[0] || null

  return {
    periodLabel: invoiceSummary.periodLabel,
    revenuePrimary,
    collectedRevenue: invoiceSummary.collectedRevenue,
    outstandingRevenue: invoiceSummary.outstandingRevenue,
    retainerRevenue: invoiceSummary.retainerRevenue,
    commissionRevenue: invoiceSummary.commissionRevenue,
    adSpend: latestPerformance.spend || (useFallback ? fallbackMetrics.ad_spend : 0),
    leads: latestPerformance.leads || (useFallback ? fallbackMetrics.leads : 0),
    conversions: latestPerformance.conversions,
    clicks: latestPerformance.clicks || (useFallback ? fallbackMetrics.clicks : 0),
    impressions: latestPerformance.impressions || (useFallback ? fallbackMetrics.impressions : 0),
    ctr: latestPerformance.ctr || (useFallback ? fallbackMetrics.ctr : 0),
    cpl: latestPerformance.cpl || (useFallback ? fallbackMetrics.cpl : 0),
    roas: latestPerformance.roas || (useFallback ? fallbackMetrics.roas : 0),
    closeRate,
    revenuePerLead,
    costPerSale,
    paidCount: invoiceSummary.paidCount,
    outstandingCount: invoiceSummary.outstandingCount,
    topPlatform,
    platformSplit,
    performance,
  }
}

const PIE_COLORS = ['#6C5CE7', '#34D399', '#FBBF24']

const CustomPieTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-bg-elevated border border-white/[0.08] rounded px-3 py-2 text-xs shadow-elevated">
      <p className="text-text-secondary mb-1">{payload[0].name}</p>
      <p className="text-text-primary font-mono-data font-semibold">{formatCurrency(payload[0].value)}</p>
    </div>
  )
}

const CustomLineTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-bg-elevated border border-white/[0.08] rounded px-3 py-2 text-xs shadow-elevated space-y-1">
      <p className="text-text-secondary">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="font-mono-data font-semibold" style={{ color: p.color }}>
          {p.name}: {p.name === 'Leads' ? p.value : formatCurrency(p.value)}
        </p>
      ))}
    </div>
  )
}

export default function ClientDashboard() {
  const { profile } = useAuth()
  const fallbackMetrics = DEMO_CLIENT_METRICS
  const [analysisModal, setAnalysisModal] = useState(null)
  const [dashboardLoading, setDashboardLoading] = useState(!isDemoMode)
  const [adPerformance, setAdPerformance] = useState(isDemoMode ? DEMO_AD_PERFORMANCE : [])
  const [invoiceRows, setInvoiceRows] = useState(isDemoMode ? DEMO_INVOICES.filter((invoice) => invoice.client_id === DEMO_CLIENT_ID) : [])
  const [metaConnected, setMetaConnected] = useState(null)
  const [syncing, setSyncing] = useState(false)
  const [syncMessage, setSyncMessage] = useState(null)

  const clientId = profile?.client_id

  useEffect(() => {
    if (isDemoMode || !clientId) {
      setDashboardLoading(false)
      return
    }

    async function loadDashboardData() {
      setDashboardLoading(true)
      try {
        const [
          { data: adData, error: adError },
          { data: invoiceData, error: invoiceError },
          { data: clientRow },
        ] = await Promise.all([
          supabase.from('ad_performance').select('*').order('date', { ascending: true }),
          supabase.from('invoices').select('*').order('created_at', { ascending: false }),
          supabase.from('clients').select('meta_ad_account_id').eq('id', clientId).maybeSingle(),
        ])
        if (adError) throw adError
        if (invoiceError) throw invoiceError
        setAdPerformance(adData || [])
        setInvoiceRows(invoiceData || [])
        setMetaConnected(Boolean(clientRow?.meta_ad_account_id))
      } catch (error) {
        console.error('Failed to load client dashboard data:', error)
        setAdPerformance([])
        setInvoiceRows([])
      } finally {
        setDashboardLoading(false)
      }
    }

    loadDashboardData()
  }, [clientId])

  async function handleSyncMeta() {
    if (!clientId) return
    setSyncing(true)
    setSyncMessage(null)
    try {
      const res = await fetch('/api/meta/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: clientId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setSyncMessage(`Synced ${data.rows_synced} entries`)
      const { data: adData } = await supabase.from('ad_performance').select('*').order('date', { ascending: true })
      setAdPerformance(adData || [])
    } catch (err) {
      setSyncMessage(err.message || 'Sync failed')
    } finally {
      setSyncing(false)
    }
  }

  const metrics = buildDashboardMetrics({
    performanceRows: aggregatePerformanceRows(adPerformance),
    invoices: invoiceRows,
    fallbackMetrics,
    useFallback: isDemoMode,
  })

  const chartData = metrics.performance.length ? metrics.performance : (isDemoMode ? aggregatePerformanceRows(DEMO_AD_PERFORMANCE) : [])
  const pieDataRaw = [
    { name: 'Collected', value: metrics.collectedRevenue },
    { name: 'Commission', value: metrics.commissionRevenue },
    { name: 'Outstanding', value: metrics.outstandingRevenue },
  ]
  const hasPieValues = pieDataRaw.some((item) => item.value > 0)
  const pieData = hasPieValues ? pieDataRaw : [{ name: 'Revenue Mix', value: Math.max(metrics.revenuePrimary, 1) }]
  const pieColors = hasPieValues ? PIE_COLORS : [PIE_COLORS[0]]

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1440px] mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-h2 font-heading text-text-primary">
          Hello, {profile?.full_name?.split(' ')[0] ?? 'there'}
        </h1>
        <p className="text-text-secondary text-sm mt-1">
          Revenue view for {metrics.periodLabel}.
        </p>
      </div>

      <OnboardingChecklist calendlyUrl="https://calendly.com/virtuecore" />

      {/* Meta connect banner */}
      {!isDemoMode && metaConnected === false && (
        <div className="vc-card border-status-warning/20 bg-status-warning/5 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-status-warning">Connect your Facebook Ads account</p>
            <p className="text-xs text-text-secondary mt-0.5">Link your Facebook Ads Manager to see live campaign data here.</p>
          </div>
          <Link
            to="/client/integrations"
            className="flex-shrink-0 bg-status-warning/10 hover:bg-status-warning/20 text-status-warning border border-status-warning/20 text-xs font-medium px-4 py-2 rounded-btn transition-colors"
          >
            Connect
          </Link>
        </div>
      )}

      {/* Meta connected status */}
      {!isDemoMode && metaConnected === true && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-status-success font-medium flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-status-success inline-block" />
            Facebook Ads connected
          </p>
          <button
            onClick={handleSyncMeta}
            disabled={syncing}
            className="flex items-center gap-1.5 text-xs text-text-secondary hover:text-text-primary disabled:opacity-50 transition-colors"
          >
            <RefreshCw size={12} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'Syncing…' : syncMessage ?? 'Sync now'}
          </button>
        </div>
      )}

      {/* Revenue hero + pie */}
      <div className="vc-card grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-6">
        <div>
          <p className="vc-section-label">Primary KPI</p>
          <h2 className="text-sm font-medium text-text-secondary mt-3">Revenue</h2>
          <p className="text-5xl lg:text-6xl font-heading font-semibold text-text-primary mt-2 tracking-tight font-mono-data">
            {formatCurrency(metrics.revenuePrimary)}
          </p>
          <div className="grid grid-cols-2 gap-3 mt-6 max-w-xl">
            <div className="bg-bg-tertiary border border-white/[0.06] rounded-card px-4 py-3">
              <p className="vc-section-label">Collected</p>
              <p className="text-xl font-semibold text-text-primary mt-1 font-mono-data">{formatCurrency(metrics.collectedRevenue)}</p>
            </div>
            <div className="bg-bg-tertiary border border-white/[0.06] rounded-card px-4 py-3">
              <p className="vc-section-label">Outstanding</p>
              <p className="text-xl font-semibold text-status-warning mt-1 font-mono-data">{formatCurrency(metrics.outstandingRevenue)}</p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setAnalysisModal('mix')}
          className="bg-bg-tertiary border border-white/[0.06] hover:border-white/[0.12] rounded-card p-4 text-left transition-colors"
        >
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-text-primary font-heading">Revenue Mix</h2>
            <span className="text-xs text-text-tertiary">Click for analysis</span>
          </div>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={52}
                  outerRadius={88}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={entry.name} fill={pieColors[index % pieColors.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomPieTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-1.5 mt-1">
            {pieDataRaw.map((item, index) => (
              <div key={item.name} className="flex items-center justify-between text-xs">
                <span className="text-text-secondary flex items-center gap-2">
                  <span className="inline-block w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }} />
                  {item.name}
                </span>
                <span className="text-text-primary font-mono-data font-medium">{formatCurrency(item.value)}</span>
              </div>
            ))}
          </div>
        </button>
      </div>

      {/* Trend chart */}
      <button
        type="button"
        onClick={() => setAnalysisModal('trend')}
        className="vc-card w-full text-left hover:border-white/[0.12] transition-colors"
      >
        <div className="flex items-center justify-between gap-4 mb-5">
          <div>
            <h2 className="text-sm font-semibold text-text-primary font-heading">Revenue & Lead Trend</h2>
            <p className="text-xs text-text-tertiary mt-0.5">Click chart for deeper analysis.</p>
          </div>
          {dashboardLoading && !isDemoMode && (
            <span className="text-xs text-text-tertiary">Refreshing live data...</span>
          )}
        </div>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#5A5A5E' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#5A5A5E' }} axisLine={false} tickLine={false} width={40} />
            <Tooltip content={<CustomLineTooltip />} />
            <Line type="monotone" dataKey="leads" stroke="#A29BFE" strokeWidth={2} dot={{ r: 3, fill: '#A29BFE' }} name="Leads" />
            <Line type="monotone" dataKey="revenueEstimate" stroke="#6C5CE7" strokeWidth={2.5} dot={{ r: 3, fill: '#6C5CE7' }} name="Revenue Estimate" />
          </LineChart>
        </ResponsiveContainer>
      </button>

      {/* Quick links */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'View Deliverables', sub: 'Review work in progress', href: '/client/deliverables' },
          { label: 'Content Calendar', sub: 'See scheduled posts', href: '/client/calendar' },
          { label: 'Messages', sub: 'Check current conversations', href: '/client/messages' },
          { label: 'Invoices', sub: 'Review billing status', href: '/client/invoices' },
        ].map((item) => (
          <a
            key={item.href}
            href={item.href}
            className="vc-card hover:border-white/[0.12] transition-colors block"
          >
            <p className="text-sm font-medium text-text-primary">{item.label}</p>
            <p className="text-xs text-text-tertiary mt-0.5">{item.sub}</p>
          </a>
        ))}
      </div>

      {/* Revenue Mix Modal */}
      <Modal
        isOpen={analysisModal === 'mix'}
        onClose={() => setAnalysisModal(null)}
        title="Revenue Mix Analysis"
        size="lg"
      >
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {pieDataRaw.map((item, index) => (
              <div key={item.name} className="bg-bg-tertiary border border-white/[0.06] rounded-card p-4">
                <p className="vc-section-label flex items-center gap-2">
                  <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }} />
                  {item.name}
                </p>
                <p className="text-xl font-semibold text-text-primary mt-2 font-mono-data">{formatCurrency(item.value)}</p>
              </div>
            ))}
          </div>
          <p className="text-sm text-text-secondary leading-6">
            Great foundation overall. Retainer income is giving the account stability, and commission is adding upside. A light improvement area is the outstanding balance: if you can tighten follow-up slightly, total revenue quality improves without needing more ad spend.
          </p>
        </div>
      </Modal>

      {/* Trend Analysis Modal */}
      <Modal
        isOpen={analysisModal === 'trend'}
        onClose={() => setAnalysisModal(null)}
        title="Trend Analysis"
        size="lg"
      >
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
            Momentum is positive: lead volume and revenue trend are moving in the right direction together. A light area to watch is efficiency drift; if spend grows faster than conversions for too long, CPL can rise. Right now you are still in a strong zone, so this is more of a tuning note than a warning.
          </p>
        </div>
      </Modal>
    </div>
  )
}
