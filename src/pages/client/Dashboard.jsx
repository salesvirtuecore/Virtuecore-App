import { useEffect, useState } from 'react'
import { BarChart3, ChevronRight, CircleDollarSign } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import StatCard from '../../components/ui/StatCard'
import Modal from '../../components/ui/Modal'
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

function SummaryPanel({ eyebrow, title, points, stats, onOpen, icon: Icon }) {
  return (
    <div className="border border-vc-border p-5 bg-white">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-vc-muted">{eyebrow}</p>
          <h2 className="text-lg font-semibold text-vc-text mt-2">{title}</h2>
        </div>
        <div className="p-2 bg-vc-secondary text-vc-muted">
          <Icon size={18} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mt-5">
        {stats.map((stat) => (
          <div key={stat.label} className="border border-vc-border px-3 py-3">
            <p className="text-[11px] uppercase tracking-wide text-vc-muted">{stat.label}</p>
            <p className="text-lg font-semibold text-vc-text mt-1">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-5 space-y-2">
        {points.map((point) => (
          <p key={point} className="text-sm text-vc-muted leading-6">
            {point}
          </p>
        ))}
      </div>

      <button
        onClick={onOpen}
        className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-vc-text hover:text-gold transition-colors"
      >
        View deeper analysis
        <ChevronRight size={16} />
      </button>
    </div>
  )
}

export default function ClientDashboard() {
  const { profile } = useAuth()
  const fallbackMetrics = DEMO_CLIENT_METRICS
  const [stripeStatus, setStripeStatus] = useState({ loading: !isDemoMode, connected: false, onboardingComplete: false, accountId: null })
  const [stripeError, setStripeError] = useState('')
  const [connecting, setConnecting] = useState(false)
  const [analysisModal, setAnalysisModal] = useState(null)
  const [dashboardLoading, setDashboardLoading] = useState(!isDemoMode)
  const [adPerformance, setAdPerformance] = useState(DEMO_AD_PERFORMANCE)
  const [invoiceRows, setInvoiceRows] = useState(DEMO_INVOICES.filter((invoice) => invoice.client_id === DEMO_CLIENT_ID))

  function formatStripeError(message) {
    if (!message) return 'Stripe connection failed'
    if (message.includes('clients.stripe_account_id')) {
      return 'Stripe setup is still being finalized by the admin. Please try again in a few minutes.'
    }
    if (message.includes('Stripe Connect is not enabled')) {
      return 'Stripe Connect is not enabled yet on the platform account. Please ask admin to enable it in Stripe settings.'
    }
    return message
  }

  async function getAccessToken() {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session?.access_token) {
      throw new Error('Session expired. Please sign in again.')
    }

    return session.access_token
  }

  useEffect(() => {
    if (isDemoMode || !profile?.client_id) {
      setDashboardLoading(false)
      return
    }

    async function loadDashboardData() {
      setDashboardLoading(true)

      try {
        const [{ data: adData, error: adError }, { data: invoiceData, error: invoiceError }] = await Promise.all([
          supabase.from('ad_performance').select('*').order('date', { ascending: true }),
          supabase.from('invoices').select('*').order('created_at', { ascending: false }),
        ])

        if (adError) throw adError
        if (invoiceError) throw invoiceError

        setAdPerformance(adData || [])
        setInvoiceRows(invoiceData || [])
      } catch (error) {
        console.error('Failed to load client dashboard data:', error)
        setAdPerformance([])
        setInvoiceRows([])
      } finally {
        setDashboardLoading(false)
      }
    }

    loadDashboardData()
  }, [profile?.client_id])

  useEffect(() => {
    if (isDemoMode || !profile?.id) return

    async function loadStripeStatus() {
      setStripeError('')

      try {
        const accessToken = await getAccessToken()
        const response = await fetch('/api/stripe/client-connect', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        })

        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'Could not load Stripe status')

        setStripeStatus({
          loading: false,
          connected: Boolean(data?.stripeAccountId),
          onboardingComplete: Boolean(data?.onboardingComplete),
          accountId: data?.stripeAccountId || null,
        })
      } catch (error) {
        setStripeStatus({ loading: false, connected: false, onboardingComplete: false, accountId: null })
        setStripeError(formatStripeError(error.message))
      }
    }

    loadStripeStatus()
  }, [profile?.id, profile?.client_id, profile?.email])

  async function connectStripe() {
    if (isDemoMode) return

    setStripeError('')
    setConnecting(true)

    try {
      const accessToken = await getAccessToken()

      const response = await fetch('/api/stripe/client-connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Stripe connect failed')

      setStripeStatus({
        loading: false,
        connected: Boolean(data?.stripeAccountId),
        onboardingComplete: Boolean(data?.onboardingComplete),
        accountId: data?.stripeAccountId || null,
      })

      if (data.connectUrl) {
        window.location.assign(data.connectUrl)
      }
    } catch (err) {
      setStripeError(formatStripeError(err.message))
    } finally {
      setConnecting(false)
    }
  }

  const metrics = buildDashboardMetrics({
    performanceRows: aggregatePerformanceRows(adPerformance),
    invoices: invoiceRows,
    fallbackMetrics,
    useFallback: isDemoMode,
  })

  const marketingSummaryPoints = [
    `${metrics.topPlatform?.platform || 'Top channel'} is carrying the heaviest load with ${metrics.topPlatform?.leads || metrics.leads} leads from ${formatCurrency(metrics.topPlatform?.spend || metrics.adSpend)} in spend.`,
    `Your current efficiency is ${formatCurrency(metrics.cpl)} per lead on ${formatCurrency(metrics.adSpend)} spend, with click-through rate sitting at ${formatPercent(metrics.ctr, 2)}.`,
    `ROAS is currently ${metrics.roas.toFixed(1)}x, which means the marketing engine is converting attention into revenue at a healthy pace.`,
  ]

  const salesSummaryPoints = [
    `${formatCurrency(metrics.revenuePrimary)} is the revenue figure to watch for ${metrics.periodLabel}, with ${formatCurrency(metrics.collectedRevenue)} already landed and ${formatCurrency(metrics.outstandingRevenue)} still open.`,
    `${metrics.conversions} conversions from ${metrics.leads} leads puts lead-to-sale conversion at ${formatPercent(metrics.closeRate)}.`,
    `Revenue per lead is ${formatCurrency(metrics.revenuePerLead)}, while cost per sale is ${metrics.costPerSale ? formatCurrency(metrics.costPerSale) : 'Awaiting sales data'}.`,
  ]

  const chartData = metrics.performance.length ? metrics.performance : aggregatePerformanceRows(DEMO_AD_PERFORMANCE)

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-vc-text">
          Hello, {profile?.full_name?.split(' ')[0] ?? 'there'}
        </h1>
        <p className="text-sm text-vc-muted mt-0.5">
          Your dashboard is centered on revenue, with separate marketing and sales analysis for {metrics.periodLabel}.
        </p>
      </div>

      <div className="border border-vc-border bg-white p-6 lg:p-8 grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-6">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] text-vc-muted">Primary KPI</p>
          <h2 className="text-sm font-medium text-vc-muted mt-3">Revenue</h2>
          <p className="text-5xl lg:text-6xl font-semibold text-vc-text mt-2 tracking-tight">
            {formatCurrency(metrics.revenuePrimary)}
          </p>
          <p className="text-sm text-vc-muted mt-3 max-w-xl leading-6">
            This sits at the top because it shows whether the marketing activity is translating into real commercial return.
          </p>

          <div className="grid grid-cols-2 gap-3 mt-6 max-w-xl">
            <div className="border border-vc-border px-4 py-4">
              <p className="text-[11px] uppercase tracking-wide text-vc-muted">Collected</p>
              <p className="text-2xl font-semibold text-vc-text mt-1">{formatCurrency(metrics.collectedRevenue)}</p>
            </div>
            <div className="border border-vc-border px-4 py-4">
              <p className="text-[11px] uppercase tracking-wide text-vc-muted">Outstanding</p>
              <p className="text-2xl font-semibold text-vc-text mt-1">{formatCurrency(metrics.outstandingRevenue)}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 content-start">
          <StatCard label="Ad Spend" value={formatCurrency(metrics.adSpend)} sub={metrics.periodLabel} />
          <StatCard label="Leads" value={metrics.leads} sub="Current reporting period" />
          <StatCard label="ROAS" value={`${metrics.roas.toFixed(1)}x`} sub="Revenue efficiency" />
          <StatCard label="Close Rate" value={formatPercent(metrics.closeRate)} sub="Lead to sale" />
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Retainer Revenue" value={formatCurrency(metrics.retainerRevenue)} sub="This cycle" />
        <StatCard label="Commission Revenue" value={formatCurrency(metrics.commissionRevenue)} sub="This cycle" />
        <StatCard label="Revenue Per Lead" value={formatCurrency(metrics.revenuePerLead)} sub="Commercial quality" />
        <StatCard label="Cost Per Sale" value={metrics.costPerSale ? formatCurrency(metrics.costPerSale) : '—'} sub="Acquisition efficiency" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SummaryPanel
          eyebrow="Marketing Summary"
          title="What the campaign data is telling you"
          icon={BarChart3}
          stats={[
            { label: 'Spend', value: formatCurrency(metrics.adSpend) },
            { label: 'CPL', value: formatCurrency(metrics.cpl) },
            { label: 'CTR', value: formatPercent(metrics.ctr, 2) },
            { label: 'Top Channel', value: metrics.topPlatform?.platform || 'Awaiting data' },
          ]}
          points={marketingSummaryPoints}
          onOpen={() => setAnalysisModal('marketing')}
        />

        <SummaryPanel
          eyebrow="Sales Summary"
          title="How marketing is translating into revenue"
          icon={CircleDollarSign}
          stats={[
            { label: 'Revenue', value: formatCurrency(metrics.revenuePrimary) },
            { label: 'Collected', value: formatCurrency(metrics.collectedRevenue) },
            { label: 'Paid Invoices', value: metrics.paidCount },
            { label: 'Outstanding', value: metrics.outstandingCount },
          ]}
          points={salesSummaryPoints}
          onOpen={() => setAnalysisModal('sales')}
        />
      </div>

      <div className="border border-[#c7d2fe] bg-gradient-to-r from-[#eef2ff] to-[#f8f7ff] p-5 flex items-center justify-between gap-4 rounded">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#635bff]">Stripe</span>
            <span className="text-xs text-[#4f46e5] bg-white/80 border border-[#c7d2fe] px-2 py-0.5 rounded">Revenue Sync</span>
          </div>
          <h2 className="text-sm font-semibold text-[#312e81] mt-1">Stripe Revenue Integration</h2>
          <p className="text-sm text-[#4338ca] mt-1">
            Connect your Stripe account so invoice revenue and collection performance stay current inside your dashboard.
          </p>
          {!isDemoMode && stripeStatus.connected && (
            <p className="text-xs text-green-700 mt-2">
              Connected{stripeStatus.accountId ? ` (${stripeStatus.accountId})` : ''}
            </p>
          )}
          {!isDemoMode && stripeError && (
            <p className="text-xs text-red-600 mt-2">{stripeError}</p>
          )}
        </div>

        {isDemoMode ? (
          <button className="text-xs px-3 py-2 border border-[#c7d2fe] text-[#6366f1] bg-white rounded" disabled>
            Demo mode
          </button>
        ) : stripeStatus.loading ? (
          <button className="text-xs px-3 py-2 border border-[#c7d2fe] text-[#6366f1] bg-white rounded" disabled>
            Checking...
          </button>
        ) : stripeStatus.connected ? (
          <button
            onClick={connectStripe}
            disabled={connecting}
            className="text-xs px-3 py-2 border border-[#635bff] text-[#4338ca] bg-white hover:bg-[#eef2ff] rounded transition-colors"
          >
            {connecting ? 'Opening...' : stripeStatus.onboardingComplete ? 'Manage Stripe' : 'Continue Stripe Setup'}
          </button>
        ) : (
          <button
            onClick={connectStripe}
            disabled={connecting}
            className="text-xs px-3 py-2 bg-[#635bff] text-white hover:bg-[#4f46e5] rounded transition-colors"
          >
            {connecting ? 'Connecting...' : 'Connect Stripe'}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="border border-vc-border p-5 bg-white">
          <h2 className="text-sm font-medium text-vc-text mb-4">Marketing Channel Breakdown</h2>
          {(metrics.platformSplit.length ? metrics.platformSplit : fallbackMetrics.platform_split).map((platform) => (
            <div key={platform.platform} className="mb-4 last:mb-0">
              <div className="flex justify-between text-sm mb-1.5 gap-4">
                <span className="text-vc-text font-medium">{platform.platform}</span>
                <span className="text-vc-muted text-right">
                  {formatCurrency(platform.spend)} · {platform.leads} leads
                </span>
              </div>
              <div className="h-1.5 bg-vc-border">
                <div
                  className="h-full bg-vc-text"
                  style={{ width: `${metrics.adSpend ? (platform.spend / metrics.adSpend) * 100 : 0}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="lg:col-span-2 border border-vc-border p-5 bg-white">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div>
              <h2 className="text-sm font-medium text-vc-text">Revenue and Lead Trend</h2>
              <p className="text-xs text-vc-muted mt-1">Track whether volume and commercial return are moving together.</p>
            </div>
            {dashboardLoading && !isDemoMode && (
              <span className="text-xs text-vc-muted">Refreshing live data...</span>
            )}
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#666666' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#666666' }} axisLine={false} tickLine={false} />
              <Tooltip />
              <Line type="monotone" dataKey="leads" stroke="#D4A843" strokeWidth={2} dot={{ r: 3, fill: '#D4A843' }} name="Leads" />
              <Line type="monotone" dataKey="revenueEstimate" stroke="#1A1A1A" strokeWidth={2} dot={{ r: 3, fill: '#1A1A1A' }} name="Revenue Estimate" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

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
        isOpen={analysisModal === 'marketing'}
        onClose={() => setAnalysisModal(null)}
        title="Marketing Analysis"
        size="lg"
      >
        <div className="space-y-5">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="border border-vc-border p-4">
              <p className="text-xs uppercase tracking-wide text-vc-muted">Spend</p>
              <p className="text-xl font-semibold text-vc-text mt-1">{formatCurrency(metrics.adSpend)}</p>
            </div>
            <div className="border border-vc-border p-4">
              <p className="text-xs uppercase tracking-wide text-vc-muted">Leads</p>
              <p className="text-xl font-semibold text-vc-text mt-1">{metrics.leads}</p>
            </div>
            <div className="border border-vc-border p-4">
              <p className="text-xs uppercase tracking-wide text-vc-muted">CTR</p>
              <p className="text-xl font-semibold text-vc-text mt-1">{formatPercent(metrics.ctr, 2)}</p>
            </div>
            <div className="border border-vc-border p-4">
              <p className="text-xs uppercase tracking-wide text-vc-muted">ROAS</p>
              <p className="text-xl font-semibold text-vc-text mt-1">{metrics.roas.toFixed(1)}x</p>
            </div>
          </div>

          <div className="border border-vc-border p-5">
            <h3 className="text-sm font-semibold text-vc-text">What is working</h3>
            <div className="mt-3 space-y-2 text-sm text-vc-muted leading-6">
              <p>{marketingSummaryPoints[0]}</p>
              <p>{marketingSummaryPoints[1]}</p>
            </div>
          </div>

          <div className="border border-vc-border p-5">
            <h3 className="text-sm font-semibold text-vc-text">Channel split</h3>
            <div className="mt-4 space-y-4">
              {(metrics.platformSplit.length ? metrics.platformSplit : fallbackMetrics.platform_split).map((platform) => (
                <div key={platform.platform}>
                  <div className="flex items-center justify-between gap-4 text-sm">
                    <span className="font-medium text-vc-text">{platform.platform}</span>
                    <span className="text-vc-muted">{formatCurrency(platform.spend)} spend · {platform.leads} leads</span>
                  </div>
                  <div className="h-2 bg-vc-border mt-2">
                    <div
                      className="h-full bg-gold"
                      style={{ width: `${metrics.adSpend ? (platform.spend / metrics.adSpend) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="border border-vc-border p-5">
            <h3 className="text-sm font-semibold text-vc-text">Deeper read</h3>
            <p className="text-sm text-vc-muted mt-3 leading-6">
              The marketing picture is strongest when spend, lead volume, and ROAS move together. Right now you are generating {metrics.leads} leads at {formatCurrency(metrics.cpl)} CPL, which suggests the acquisition engine is functioning. The key next question is whether the same channel mix keeps producing qualified leads at the same efficiency as spend scales.
            </p>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={analysisModal === 'sales'}
        onClose={() => setAnalysisModal(null)}
        title="Sales Analysis"
        size="lg"
      >
        <div className="space-y-5">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="border border-vc-border p-4">
              <p className="text-xs uppercase tracking-wide text-vc-muted">Revenue</p>
              <p className="text-xl font-semibold text-vc-text mt-1">{formatCurrency(metrics.revenuePrimary)}</p>
            </div>
            <div className="border border-vc-border p-4">
              <p className="text-xs uppercase tracking-wide text-vc-muted">Collected</p>
              <p className="text-xl font-semibold text-vc-text mt-1">{formatCurrency(metrics.collectedRevenue)}</p>
            </div>
            <div className="border border-vc-border p-4">
              <p className="text-xs uppercase tracking-wide text-vc-muted">Close Rate</p>
              <p className="text-xl font-semibold text-vc-text mt-1">{formatPercent(metrics.closeRate)}</p>
            </div>
            <div className="border border-vc-border p-4">
              <p className="text-xs uppercase tracking-wide text-vc-muted">Revenue / Lead</p>
              <p className="text-xl font-semibold text-vc-text mt-1">{formatCurrency(metrics.revenuePerLead)}</p>
            </div>
          </div>

          <div className="border border-vc-border p-5">
            <h3 className="text-sm font-semibold text-vc-text">Commercial breakdown</h3>
            <div className="grid grid-cols-2 gap-3 mt-4">
              <div className="border border-vc-border p-4">
                <p className="text-xs uppercase tracking-wide text-vc-muted">Retainer Revenue</p>
                <p className="text-lg font-semibold text-vc-text mt-1">{formatCurrency(metrics.retainerRevenue)}</p>
              </div>
              <div className="border border-vc-border p-4">
                <p className="text-xs uppercase tracking-wide text-vc-muted">Commission Revenue</p>
                <p className="text-lg font-semibold text-vc-text mt-1">{formatCurrency(metrics.commissionRevenue)}</p>
              </div>
              <div className="border border-vc-border p-4">
                <p className="text-xs uppercase tracking-wide text-vc-muted">Paid Invoices</p>
                <p className="text-lg font-semibold text-vc-text mt-1">{metrics.paidCount}</p>
              </div>
              <div className="border border-vc-border p-4">
                <p className="text-xs uppercase tracking-wide text-vc-muted">Outstanding Invoices</p>
                <p className="text-lg font-semibold text-vc-text mt-1">{metrics.outstandingCount}</p>
              </div>
            </div>
          </div>

          <div className="border border-vc-border p-5">
            <h3 className="text-sm font-semibold text-vc-text">What the sales data says</h3>
            <div className="mt-3 space-y-2 text-sm text-vc-muted leading-6">
              {salesSummaryPoints.map((point) => (
                <p key={point}>{point}</p>
              ))}
            </div>
          </div>

          <div className="border border-vc-border p-5">
            <h3 className="text-sm font-semibold text-vc-text">Deeper read</h3>
            <p className="text-sm text-vc-muted mt-3 leading-6">
              Sales performance is strongest when collections keep pace with conversions. This view separates total revenue from cash already collected so you can see whether growth is real or still sitting in outstanding invoices. If close rate rises without revenue moving, the issue is likely pricing or collections rather than campaign quality.
            </p>
          </div>
        </div>
      </Modal>
    </div>
  )
}
