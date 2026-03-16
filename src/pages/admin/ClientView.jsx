import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Sparkles, X } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import Badge from '../../components/ui/Badge'
import StatCard from '../../components/ui/StatCard'
import {
  DEMO_CLIENTS, DEMO_AD_PERFORMANCE, DEMO_CLIENT_METRICS,
  DEMO_DELIVERABLES, DEMO_MESSAGES, DEMO_INVOICES,
} from '../../data/placeholder'
import { isDemoMode } from '../../lib/supabase'

const HEALTH_BADGE = { green: 'green', amber: 'amber', red: 'red' }

// Sample report shown in demo mode
const DEMO_REPORT_PREVIEW = `## Executive Summary

Hartley & Sons Roofing delivered its strongest month to date in March 2026, generating 67 qualified leads at a Cost Per Lead of £125 — a 6% improvement on February. Return on Ad Spend reached 5.8x, reflecting both improved creative performance and tighter audience targeting implemented mid-month.

## Key Highlights

- **67 leads** generated in March (Feb: 61, +10% MoM)
- **CPL reduced** to £125 from £133 — down 6% month-on-month
- **ROAS of 5.8x** — highest recorded since campaign launch
- Meta emergency call-out creative (A/B variant) outperformed control by 34% on CTR
- Google Ads search impression share improved from 61% to 74% following negative keyword audit

## Platform Breakdown

**Meta Ads — £5,200 spend**
- 44 leads at £118 CPL
- Top performing ad set: Emergency Roofing — North Manchester (CTR 2.4%)
- Lead form completion rate: 68%

**Google Ads — £3,200 spend**
- 23 leads at £139 CPL
- Top keyword: "emergency roofer Manchester" — 12 conversions
- Quality Score average improved to 7.2/10

## Recommendations

1. **Increase Meta budget by 15%** — the emergency call-out angle is performing well and has headroom to scale before saturation
2. **Test video creative on Meta** — static ads dominating spend; a short testimonial video could lower CPL further
3. **Add remarketing campaign on Google** — website visitors not converting represent a warm audience currently untapped
4. **Review Google Ad schedule** — data suggests leads drop significantly on Sundays; reallocate budget to Mon–Sat
5. **Expand to Instagram Stories placement** — currently only running in Feed; Stories inventory is cheaper and drives volume

## Next Steps

- **By 20 March**: VA to brief new video testimonial creative
- **By 22 March**: Launch Google remarketing campaign (brief attached)
- **1 April**: Review April budget allocation based on March final data`

export default function ClientView() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [reportLoading, setReportLoading] = useState(false)
  const [reportModal, setReportModal] = useState(null) // { text, saved }
  const [reportToast, setReportToast] = useState(false)
  const client = DEMO_CLIENTS.find((c) => c.id === id)

  if (!client) {
    return (
      <div className="p-6">
        <button onClick={() => navigate('/admin/clients')} className="flex items-center gap-1 text-sm text-vc-muted hover:text-vc-text mb-4">
          <ArrowLeft size={14} /> Back to Clients
        </button>
        <p className="text-sm text-vc-muted">Client not found.</p>
      </div>
    )
  }

  const metrics = DEMO_CLIENT_METRICS
  const deliverables = DEMO_DELIVERABLES.filter((d) => d.client_id === id)
  const messages = DEMO_MESSAGES.filter((m) => m.client_id === id)
  const invoices = DEMO_INVOICES.filter((i) => i.client_id === id)

  async function handleGenerateReport() {
    setReportLoading(true)
    try {
      if (isDemoMode) {
        // Simulate a short delay, then show a preview modal with sample report
        await new Promise((r) => setTimeout(r, 1800))
        setReportModal({ text: DEMO_REPORT_PREVIEW, saved: true })
      } else {
        const res = await fetch('/api/generate-report', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            client_id: client.id,
            client_name: client.company_name,
            period: 'March 2026',
            ad_data: DEMO_AD_PERFORMANCE,
          }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? 'Report generation failed')
        setReportToast(true)
        setTimeout(() => setReportToast(false), 4000)
        setReportModal({ text: data.report, saved: true })
      }
    } catch (err) {
      console.error('Generate report error:', err)
    } finally {
      setReportLoading(false)
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Report toast */}
      {reportToast && (
        <div className="fixed top-4 right-4 z-50 bg-vc-text text-white text-sm px-4 py-3 shadow-md flex items-center gap-2">
          <Sparkles size={14} className="text-gold" />
          Report generated and saved to deliverables.
        </div>
      )}

      {/* Report modal */}
      {reportModal && (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4" onClick={() => setReportModal(null)}>
          <div
            className="bg-white w-full max-w-2xl max-h-[80vh] flex flex-col border border-vc-border shadow-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-vc-border flex-shrink-0">
              <div>
                <h3 className="text-sm font-semibold text-vc-text">AI-Generated Report Preview</h3>
                {reportModal.saved && (
                  <p className="text-xs text-green-600 mt-0.5">Saved to deliverables as draft</p>
                )}
              </div>
              <button onClick={() => setReportModal(null)} className="text-vc-muted hover:text-vc-text">
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <pre className="text-sm text-vc-text whitespace-pre-wrap font-sans leading-relaxed">
                {reportModal.text}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* Back + header */}
      <div>
        <button onClick={() => navigate('/admin/clients')} className="flex items-center gap-1 text-sm text-vc-muted hover:text-vc-text mb-3 transition-colors">
          <ArrowLeft size={14} /> Back to Clients
        </button>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold text-vc-text">{client.company_name}</h1>
            <p className="text-sm text-vc-muted">{client.contact_name} · {client.contact_email}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={HEALTH_BADGE[client.health_score]}>
              {client.health_score.charAt(0).toUpperCase() + client.health_score.slice(1)} health
            </Badge>
            <Badge variant={client.status === 'active' ? 'green' : 'blue'}>
              {client.status.charAt(0).toUpperCase() + client.status.slice(1)}
            </Badge>
            <button
              onClick={handleGenerateReport}
              disabled={reportLoading}
              className="flex items-center gap-1.5 bg-gold hover:bg-amber-600 disabled:opacity-60 text-white text-sm px-4 py-2 transition-colors"
            >
              <Sparkles size={14} />
              {reportLoading ? 'Generating…' : 'Generate AI Report'}
            </button>
          </div>
        </div>
      </div>

      {/* Admin-only note */}
      <div className="bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
        <span className="font-medium">Admin view:</span> You are viewing this client's portal. Internal notes and full data visible.
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Ad Spend (Mar)" value={`£${metrics.ad_spend.toLocaleString()}`} />
        <StatCard label="Leads (Mar)" value={metrics.leads} />
        <StatCard label="CPL" value={`£${metrics.cpl}`} />
        <StatCard label="ROAS" value={`${metrics.roas}x`} />
      </div>

      {/* Performance chart */}
      <div className="border border-vc-border p-5">
        <h2 className="text-sm font-medium text-vc-text mb-4">Performance Trend (6 months)</h2>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={DEMO_AD_PERFORMANCE}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#666666' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#666666' }} axisLine={false} tickLine={false} />
            <Tooltip />
            <Line type="monotone" dataKey="leads" stroke="#D4A843" strokeWidth={2} name="Leads" dot={{ r: 3 }} />
            <Line type="monotone" dataKey="cpl" stroke="#1A1A1A" strokeWidth={2} name="CPL (£)" dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Deliverables */}
        <div className="border border-vc-border">
          <div className="px-4 py-3 border-b border-vc-border">
            <h2 className="text-sm font-medium text-vc-text">Deliverables</h2>
          </div>
          <div className="divide-y divide-vc-border">
            {deliverables.map((d) => (
              <div key={d.id} className="px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-vc-text">{d.title}</p>
                  <p className="text-xs text-vc-muted capitalize">{d.type.replace('_', ' ')}</p>
                </div>
                <Badge variant={d.status === 'approved' ? 'green' : d.status === 'changes_requested' ? 'red' : d.status === 'pending_review' ? 'amber' : 'default'}>
                  {d.status.replace('_', ' ')}
                </Badge>
              </div>
            ))}
          </div>
        </div>

        {/* Messages */}
        <div className="border border-vc-border">
          <div className="px-4 py-3 border-b border-vc-border">
            <h2 className="text-sm font-medium text-vc-text">Messages</h2>
          </div>
          <div className="divide-y divide-vc-border max-h-64 overflow-y-auto">
            {messages.map((msg) => (
              <div key={msg.id} className="px-4 py-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium text-vc-text">{msg.sender_name}</span>
                  <span className="text-xs text-vc-muted">{new Date(msg.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <p className="text-sm text-vc-text">{msg.content}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Invoices */}
      <div className="border border-vc-border">
        <div className="px-5 py-3 border-b border-vc-border">
          <h2 className="text-sm font-medium text-vc-text">Invoices</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-vc-border bg-vc-secondary">
              <th className="text-left px-5 py-2.5 text-xs text-vc-muted font-medium">Type</th>
              <th className="text-left px-5 py-2.5 text-xs text-vc-muted font-medium">Amount</th>
              <th className="text-left px-5 py-2.5 text-xs text-vc-muted font-medium">Due</th>
              <th className="text-left px-5 py-2.5 text-xs text-vc-muted font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv) => (
              <tr key={inv.id} className="border-b border-vc-border last:border-0">
                <td className="px-5 py-3 capitalize text-vc-text">{inv.type}</td>
                <td className="px-5 py-3 font-medium text-vc-text">£{inv.amount.toLocaleString()}</td>
                <td className="px-5 py-3 text-vc-muted">{inv.due_date}</td>
                <td className="px-5 py-3">
                  <Badge variant={inv.status === 'paid' ? 'green' : inv.status === 'overdue' ? 'red' : inv.status === 'sent' ? 'blue' : 'default'}>
                    {inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}
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
