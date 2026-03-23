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

export default function ClientDashboard() {
  const { profile } = useAuth()
  const fallbackMetrics = DEMO_CLIENT_METRICS
  const [analysisModal, setAnalysisModal] = useState(null)
  const [dashboardLoading, setDashboardLoading] = useState(!isDemoMode)
  const [adPerformance, setAdPerformance] = useState(isDemoMode ? DEMO_AD_PERFORMANCE : [])
  const [invoiceRows, setInvoiceRows] = useState(isDemoMode ? DEMO_INVOICES.filter((invoice) => invoice.client_id === DEMO_CLIENT_ID) : [])
  const [metaConnected, setMetaConnected] = useState(null) // null = unknown, true/false
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
      // Reload ad data
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
  const pieColors = hasPieValues ? ['#6D28D9', '#1A1A1A', '#D4A843'] : ['#6D28D9']

  return (
    <div className="p-4 md:p-6 space-y-6 w-full overflow-x-hidden">
      <div>
        <h1 className="text-xl font-semibold text-vc-text">
          Hello, {profile?.full_name?.split(' ')[0] ?? 'there'}
        </h1>
        <p className="text-sm text-vc-muted mt-0.5">
          Revenue view for {metrics.periodLabel}.
        </p>
      </div>

      <OnboardingChecklist calendlyUrl="https://calendly.com/virtuecore" />

      {/* Meta Ads connect / sync banner */}
      {!isDemoMode && metaConnected === false && (
        <div className="border border-amber-200 bg-amber-50 px-4 py-3 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-amber-900">Connect your Facebook Ads account</p>
            <p className="text-xs text-amber-700 mt-0.5">Link your Facebook Ads Manager to see live campaign data here.</p>
          </div>
          <Link
            to="/client/integrations"
            className="flex-shrink-0 bg-gold hover:bg-gold-dark text-white text-xs font-medium px-4 py-2"
          >
            Connect
          </Link>
        </div>
      )}

      {!isDemoMode && metaConnected === true && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-green-700 font-medium">● Facebook Ads connected</p>
          <button
            onClick={handleSyncMeta}
            disabled={syncing}
            className="flex items-center gap-1.5 text-xs text-vc-muted hover:text-vc-text disabled:opacity-50"
          >
            <RefreshCw size={12} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'Syncing…' : syncMessage ?? 'Sync now'}
          </button>
        </div>
      )}

      <div className="border border-vc-border bg-white p-6 lg:p-8 grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-6">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] text-vc-muted">Primary KPI</p>
          <h2 className="text-sm font-medium text-vc-muted mt-3">Revenue</h2>
          <p className="text-5xl lg:text-6xl font-semibold text-vc-text mt-2 tracking-tight">
            {formatCurrency(metrics.revenuePrimary)}
          </p>
          <div className="grid grid-cols-2 gap-3 mt-6 max-w-xl">
            <div className="border border-vc-border px-4 py-3">
              <p className="text-[11px] uppercase tracking-wide text-vc-muted">Collected</p>
              <p className="text-xl font-semibold text-vc-text mt-1">{formatCurrency(metrics.collectedRevenue)}</p>
            </div>
            <div className="border border-vc-border px-4 py-3">
              <p className="text-[11px] uppercase tracking-wide text-vc-muted">Outstanding</p>
              <p className="text-xl font-semibold text-vc-text mt-1">{formatCurrency(metrics.outstandingRevenue)}</p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setAnalysisModal('mix')}
          className="border border-vc-border p-4 text-left hover:border-vc-text transition-colors"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-vc-text">Revenue Mix</h2>
            <span className="text-xs text-vc-muted">Click for analysis</span>
          </div>
          <div className="h-[280px] mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={58}
                  outerRadius={96}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={entry.name} fill={pieColors[index % pieColors.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatCurrency(value)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-1 gap-2 mt-2">
            {pieDataRaw.map((item, index) => (
              <div key={item.name} className="flex items-center justify-between text-xs">
                <span className="text-vc-muted flex items-center gap-2">
                  <span className="inline-block w-2.5 h-2.5" style={{ backgroundColor: pieColors[index % pieColors.length] }} />
                  {item.name}
                </span>
                <span className="text-vc-text font-medium">{formatCurrency(item.value)}</span>
              </div>
            ))}
          </div>
        </button>
      </div>

      <button
        type="button"
        onClick={() => setAnalysisModal('trend')}
        className="w-full border border-vc-border p-5 bg-white text-left hover:border-vc-text transition-colors"
      >
        <div className="flex items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-sm font-medium text-vc-text">Revenue and Lead Trend</h2>
            <p className="text-xs text-vc-muted mt-1">Click chart for deeper analysis.</p>
          </div>
          {dashboardLoading && !isDemoMode && (
            <span className="text-xs text-vc-muted">Refreshing live data...</span>
          )}
        </div>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#666666' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#666666' }} axisLine={false} tickLine={false} />
            <Tooltip />
            <Line type="monotone" dataKey="leads" stroke="#E8DCC0" strokeWidth={2} dot={{ r: 3, fill: '#E8DCC0' }} name="Leads" />
            <Line type="monotone" dataKey="revenueEstimate" stroke="#6D28D9" strokeWidth={2.5} dot={{ r: 3, fill: '#6D28D9' }} name="Revenue Estimate" />
          </LineChart>
        </ResponsiveContainer>
      </button>

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
            className="border border-vc-border p-4 hover:border-vc-text transition-colors block bg-white"
          >
            <p className="text-sm font-medium text-vc-text">{item.label}</p>
            <p className="text-xs text-vc-muted mt-0.5">{item.sub}</p>
          </a>
        ))}
      </div>

      <Modal
        isOpen={analysisModal === 'mix'}
        onClose={() => setAnalysisModal(null)}
        title="Revenue Mix Analysis"
        size="lg"
      >
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {pieDataRaw.map((item, index) => (
              <div key={item.name} className="border border-vc-border p-4">
                <p className="text-xs uppercase tracking-wide text-vc-muted flex items-center gap-2">
                  <span className="inline-block w-2.5 h-2.5" style={{ backgroundColor: pieColors[index % pieColors.length] }} />
                  {item.name}
                </p>
                <p className="text-xl font-semibold text-vc-text mt-1">{formatCurrency(item.value)}</p>
              </div>
            ))}
          </div>
          <p className="text-sm text-vc-muted leading-6">
            Great foundation overall. Retainer income is giving the account stability, and commission is adding upside. A light improvement area is the outstanding balance: if you can tighten follow-up slightly, total revenue quality improves without needing more ad spend.
          </p>
        </div>
      </Modal>

      <Modal
        isOpen={analysisModal === 'trend'}
        onClose={() => setAnalysisModal(null)}
        title="Trend Analysis"
        size="lg"
      >
        <div className="space-y-5">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="border border-vc-border p-4">
              <p className="text-xs uppercase tracking-wide text-vc-muted">Ad Spend</p>
              <p className="text-xl font-semibold text-vc-text mt-1">{formatCurrency(metrics.adSpend)}</p>
            </div>
            <div className="border border-vc-border p-4">
              <p className="text-xs uppercase tracking-wide text-vc-muted">Leads</p>
              <p className="text-xl font-semibold text-vc-text mt-1">{metrics.leads}</p>
            </div>
            <div className="border border-vc-border p-4">
              <p className="text-xs uppercase tracking-wide text-vc-muted">ROAS</p>
              <p className="text-xl font-semibold text-vc-text mt-1">{metrics.roas.toFixed(1)}x</p>
            </div>
            <div className="border border-vc-border p-4">
              <p className="text-xs uppercase tracking-wide text-vc-muted">CPL</p>
              <p className="text-xl font-semibold text-vc-text mt-1">{formatCurrency(metrics.cpl)}</p>
            </div>
          </div>
          <p className="text-sm text-vc-muted leading-6">
            Momentum is positive: lead volume and revenue trend are moving in the right direction together. A light area to watch is efficiency drift; if spend grows faster than conversions for too long, CPL can rise. Right now you are still in a strong zone, so this is more of a tuning note than a warning.
          </p>
        </div>
      </Modal>
    </div>
  )
}
