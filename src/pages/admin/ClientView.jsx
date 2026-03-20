import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Sparkles, X, Pencil, Trash2, Plus, Send, Upload, ExternalLink } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import Badge from '../../components/ui/Badge'
import StatCard from '../../components/ui/StatCard'
import Modal from '../../components/ui/Modal'
import FormField from '../../components/ui/FormField'
import {
  DEMO_CLIENTS, DEMO_AD_PERFORMANCE, DEMO_CLIENT_METRICS,
  DEMO_DELIVERABLES, DEMO_MESSAGES, DEMO_INVOICES,
} from '../../data/placeholder'
import { isDemoMode, supabase } from '../../lib/supabase'
import { useToast } from '../../context/ToastContext'
import { useAuth } from '../../context/AuthContext'
import { sendPushNotification } from '../../lib/pushNotifications'

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

// ── Deliverable form defaults ────────────────────────────────────────────────
const EMPTY_DELIVERABLE = { title: '', type: 'ad_creative', file_url: '', status: 'draft' }
const EMPTY_INVOICE = { amount: '', type: 'retainer', due_date: '', status: 'draft', stripe_invoice_id: '' }
const EMPTY_AD = {
  platform: 'meta', date: '', spend: '', impressions: '', clicks: '',
  leads: '', conversions: '', ctr: '', cpl: '', roas: '',
}
const EMPTY_MESSAGE = ''

export default function ClientView() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const { profile } = useAuth()
  const messagesBottomRef = useRef(null)

  const [reportLoading, setReportLoading] = useState(false)
  const [reportModal, setReportModal] = useState(null)
  const [reportToast, setReportToast] = useState(false)
  const [reportPeriod, setReportPeriod] = useState(() => {
    const now = new Date()
    return now.toLocaleString('en-GB', { month: 'long', year: 'numeric' })
  })

  const [client, setClient] = useState(isDemoMode ? DEMO_CLIENTS.find((c) => c.id === id) ?? null : null)
  const [loadingClient, setLoadingClient] = useState(!isDemoMode)

  // Local data state
  const [deliverables, setDeliverables] = useState(
    isDemoMode ? DEMO_DELIVERABLES.filter((d) => d.client_id === id) : []
  )
  const [invoices, setInvoices] = useState(
    isDemoMode ? DEMO_INVOICES.filter((i) => i.client_id === id) : []
  )
  const [adEntries, setAdEntries] = useState(isDemoMode ? [] : [])
  const [messages, setMessages] = useState(
    isDemoMode ? DEMO_MESSAGES.filter((m) => m.client_id === id) : []
  )

  // Modal open states
  const [showDeliverableModal, setShowDeliverableModal] = useState(false)
  const [editDeliverable, setEditDeliverable] = useState(null)
  const [showInvoiceModal, setShowInvoiceModal] = useState(false)
  const [editInvoice, setEditInvoice] = useState(null)
  const [showAdModal, setShowAdModal] = useState(false)

  // Form state
  const [deliverableForm, setDeliverableForm] = useState(EMPTY_DELIVERABLE)
  const [deliverableFile, setDeliverableFile] = useState(null)
  const [uploadingFile, setUploadingFile] = useState(false)
  const [deliverableErrors, setDeliverableErrors] = useState({})
  const [invoiceForm, setInvoiceForm] = useState(EMPTY_INVOICE)
  const [invoiceErrors, setInvoiceErrors] = useState({})
  const [adForm, setAdForm] = useState(EMPTY_AD)
  const [adErrors, setAdErrors] = useState({})
  const [messageText, setMessageText] = useState(EMPTY_MESSAGE)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (isDemoMode || !supabase) return

    let cancelled = false

    async function loadClientData() {
      setLoadingClient(true)
      try {
        const [
          { data: clientRow, error: clientError },
          { data: deliverableRows, error: deliverablesError },
          { data: invoiceRows, error: invoicesError },
          { data: messageRows, error: messagesError },
          { data: adRows, error: adError },
        ] = await Promise.all([
          supabase.from('clients').select('*').eq('id', id).maybeSingle(),
          supabase.from('deliverables').select('*').eq('client_id', id).order('created_at', { ascending: false }),
          supabase.from('invoices').select('*').eq('client_id', id).order('created_at', { ascending: false }),
          supabase.from('messages').select('*, sender:profiles!sender_id(full_name, role)').eq('client_id', id).order('created_at', { ascending: true }),
          supabase.from('ad_performance').select('*').eq('client_id', id).order('date', { ascending: true }),
        ])

        if (clientError) throw clientError
        if (deliverablesError) throw deliverablesError
        if (invoicesError) throw invoicesError
        if (messagesError) throw messagesError
        if (adError) throw adError

        if (cancelled) return

        setClient(clientRow || null)
        setDeliverables(deliverableRows || [])
        setInvoices(invoiceRows || [])
        setMessages(messageRows || [])
        setAdEntries(adRows || [])
      } catch (error) {
        if (!cancelled) {
          setClient(null)
          setDeliverables([])
          setInvoices([])
          setMessages([])
          setAdEntries([])
          showToast(error.message ?? 'Failed to load client data', 'error')
        }
      } finally {
        if (!cancelled) setLoadingClient(false)
      }
    }

    loadClientData()

    return () => {
      cancelled = true
    }
  }, [id])

  // Realtime messages subscription
  useEffect(() => {
    if (isDemoMode || !supabase) return
    const channel = supabase
      .channel(`admin-messages-${id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `client_id=eq.${id}` },
        (payload) => {
          setMessages((prev) => {
            if (prev.some((m) => m.id === payload.new.id)) return prev
            // Fetch sender info for display since realtime payloads don't include joins
            const newMsg = {
              ...payload.new,
              sender: payload.new.sender_id === profile?.id
                ? { full_name: profile?.full_name, role: 'admin' }
                : null,
            }
            return [...prev, newMsg]
          })
        }
      )
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [id])

  // Scroll messages to bottom
  useEffect(() => {
    messagesBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  if (loadingClient) {
    return (
      <div className="p-6">
        <button onClick={() => navigate('/admin/clients')} className="flex items-center gap-1 text-sm text-vc-muted hover:text-vc-text mb-4">
          <ArrowLeft size={14} /> Back to Clients
        </button>
        <p className="text-sm text-vc-muted">Loading client...</p>
      </div>
    )
  }

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

  const totalAdSpend = adEntries.reduce((sum, row) => sum + Number(row.spend || 0), 0)
  const totalLeads = adEntries.reduce((sum, row) => sum + Number(row.leads || 0), 0)
  const weightedRoasNumerator = adEntries.reduce((sum, row) => sum + Number(row.spend || 0) * Number(row.roas || 0), 0)
  const fallbackPerformance = isDemoMode
    ? DEMO_CLIENT_METRICS
    : { ad_spend: 0, leads: 0, cpl: 0, roas: 0 }
  const metrics = {
    ad_spend: totalAdSpend || fallbackPerformance.ad_spend,
    leads: totalLeads || fallbackPerformance.leads,
    cpl: totalLeads ? Math.round(totalAdSpend / totalLeads) : fallbackPerformance.cpl,
    roas: totalAdSpend ? Number((weightedRoasNumerator / totalAdSpend).toFixed(1)) : fallbackPerformance.roas,
  }
  const trendData = adEntries.length ? adEntries.map((row) => ({
    month: row.date,
    leads: Number(row.leads || 0),
    cpl: Number(row.cpl || 0),
  })) : (isDemoMode ? DEMO_AD_PERFORMANCE : [])

  // ── Generate Report ──────────────────────────────────────────────────────────
  async function handleGenerateReport() {
    setReportLoading(true)
    try {
      if (isDemoMode) {
        await new Promise((r) => setTimeout(r, 1800))
        setReportModal({ text: DEMO_REPORT_PREVIEW, saved: true })
      } else {
        const res = await fetch('/api/generate-report', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            client_id: client.id,
            client_name: client.company_name,
            period: reportPeriod,
            ad_data: adEntries,
          }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? 'Report generation failed')
        setReportToast(true)
        setTimeout(() => setReportToast(false), 4000)
        setReportModal({ text: data.report, saved: true })
      }
    } catch (err) {
      showToast(err.message ?? 'Report generation failed', 'error')
    } finally {
      setReportLoading(false)
    }
  }

  // ── Deliverable CRUD ─────────────────────────────────────────────────────────
  function openAddDeliverable() {
    setEditDeliverable(null)
    setDeliverableForm(EMPTY_DELIVERABLE)
    setDeliverableFile(null)
    setDeliverableErrors({})
    setShowDeliverableModal(true)
  }

  function openEditDeliverable(d) {
    setEditDeliverable(d)
    setDeliverableForm({ title: d.title, type: d.type, file_url: d.file_url ?? '', status: d.status })
    setDeliverableFile(null)
    setDeliverableErrors({})
    setShowDeliverableModal(true)
  }

  function sanitizeFilename(name) {
    return (name || 'file').replace(/[^a-zA-Z0-9._-]/g, '_')
  }

  async function uploadDeliverableToStorage(file) {
    if (!supabase || !file) return null

    const safeName = sanitizeFilename(file.name)
    const path = `${id}/${Date.now()}-${safeName}`

    const { error: uploadError } = await supabase
      .storage
      .from('deliverables')
      .upload(path, file, { cacheControl: '3600', upsert: false })

    if (uploadError) throw uploadError

    const { data } = supabase.storage.from('deliverables').getPublicUrl(path)
    return data?.publicUrl || null
  }

  function validateDeliverable() {
    const e = {}
    if (!deliverableForm.title.trim()) e.title = 'Title is required'
    return e
  }

  async function handleSaveDeliverable() {
    const e = validateDeliverable()
    if (Object.keys(e).length) { setDeliverableErrors(e); return }
    setSaving(true)
    try {
      setUploadingFile(Boolean(deliverableFile))

      let resolvedFileUrl = deliverableForm.file_url.trim() || null

      if (deliverableFile) {
        if (isDemoMode) {
          resolvedFileUrl = '/demo-deliverable.pdf'
        } else {
          resolvedFileUrl = await uploadDeliverableToStorage(deliverableFile)
        }
      }

      const payload = {
        title: deliverableForm.title.trim(),
        type: deliverableForm.type,
        file_url: resolvedFileUrl,
        status: deliverableForm.status,
        client_id: id,
      }
      if (isDemoMode) {
        if (editDeliverable) {
          setDeliverables((prev) =>
            prev.map((d) => (d.id === editDeliverable.id ? { ...d, ...payload } : d))
          )
        } else {
          setDeliverables((prev) => [
            ...prev,
            { ...payload, id: `d-${Date.now()}`, created_at: new Date().toISOString().split('T')[0], feedback: null },
          ])
        }
      } else {
        if (editDeliverable) {
          const { error } = await supabase.from('deliverables').update(payload).eq('id', editDeliverable.id)
          if (error) throw error
          setDeliverables((prev) =>
            prev.map((d) => (d.id === editDeliverable.id ? { ...d, ...payload } : d))
          )
        } else {
          const { data, error } = await supabase.from('deliverables').insert(payload).select().single()
          if (error) throw error
          setDeliverables((prev) => [...prev, data])

          // Notify client of new deliverable
          const { data: clientProfile } = await supabase
            .from('profiles').select('id').eq('client_id', id).eq('role', 'client').maybeSingle()
          if (clientProfile?.id) {
            sendPushNotification(clientProfile.id, {
              title: 'New deliverable ready',
              body: `${payload.title} is ready for your review.`,
              url: '/client/deliverables',
            })
          }
        }
      }
      showToast(editDeliverable ? 'Deliverable updated' : 'Deliverable created')
      setShowDeliverableModal(false)
    } catch (err) {
      showToast(err.message ?? 'Failed to save deliverable', 'error')
    } finally {
      setUploadingFile(false)
      setSaving(false)
    }
  }

  async function handleDeleteDeliverable(delId) {
    if (!confirm('Delete this deliverable?')) return
    try {
      if (!isDemoMode) {
        const { error } = await supabase.from('deliverables').delete().eq('id', delId)
        if (error) throw error
      }
      setDeliverables((prev) => prev.filter((d) => d.id !== delId))
      showToast('Deliverable deleted')
    } catch (err) {
      showToast(err.message ?? 'Failed to delete deliverable', 'error')
    }
  }

  // ── Invoice CRUD ─────────────────────────────────────────────────────────────
  function openAddInvoice() {
    setEditInvoice(null)
    setInvoiceForm(EMPTY_INVOICE)
    setInvoiceErrors({})
    setShowInvoiceModal(true)
  }

  function openEditInvoice(inv) {
    setEditInvoice(inv)
    setInvoiceForm({
      amount: inv.amount,
      type: inv.type,
      due_date: inv.due_date,
      status: inv.status,
      stripe_invoice_id: inv.stripe_invoice_id ?? '',
    })
    setInvoiceErrors({})
    setShowInvoiceModal(true)
  }

  function validateInvoice() {
    const e = {}
    if (!invoiceForm.amount || isNaN(Number(invoiceForm.amount))) e.amount = 'Valid amount required'
    if (!invoiceForm.due_date) e.due_date = 'Due date is required'
    return e
  }

  async function handleSaveInvoice() {
    const e = validateInvoice()
    if (Object.keys(e).length) { setInvoiceErrors(e); return }
    setSaving(true)
    try {
      const payload = {
        amount: Number(invoiceForm.amount),
        type: invoiceForm.type,
        due_date: invoiceForm.due_date,
        status: invoiceForm.status,
        stripe_invoice_id: invoiceForm.stripe_invoice_id.trim() || null,
        client_id: id,
        client_name: client.company_name,
      }
      if (isDemoMode) {
        if (editInvoice) {
          setInvoices((prev) => prev.map((i) => (i.id === editInvoice.id ? { ...i, ...payload } : i)))
        } else {
          setInvoices((prev) => [
            ...prev,
            { ...payload, id: `inv-${Date.now()}`, paid_date: null, created_at: new Date().toISOString().split('T')[0] },
          ])
        }
      } else {
        if (editInvoice) {
          const { error } = await supabase.from('invoices').update(payload).eq('id', editInvoice.id)
          if (error) throw error
          setInvoices((prev) => prev.map((i) => (i.id === editInvoice.id ? { ...i, ...payload } : i)))
        } else {
          const { data, error } = await supabase.from('invoices').insert(payload).select().single()
          if (error) throw error
          setInvoices((prev) => [...prev, data])

          // Notify client of new invoice
          const { data: clientProfile } = await supabase
            .from('profiles').select('id').eq('client_id', id).eq('role', 'client').maybeSingle()
          if (clientProfile?.id) {
            sendPushNotification(clientProfile.id, {
              title: 'New invoice raised',
              body: `£${Number(payload.amount).toLocaleString()} ${payload.type} invoice — due ${payload.due_date}.`,
              url: '/client/invoices',
            })
          }
        }
      }
      showToast(editInvoice ? 'Invoice updated' : 'Invoice created')
      setShowInvoiceModal(false)
    } catch (err) {
      showToast(err.message ?? 'Failed to save invoice', 'error')
    } finally {
      setSaving(false)
    }
  }

  // ── Ad Performance ───────────────────────────────────────────────────────────
  function validateAd() {
    const e = {}
    if (!adForm.date) e.date = 'Date is required'
    if (!adForm.spend || isNaN(Number(adForm.spend))) e.spend = 'Valid spend required'
    return e
  }

  async function handleSaveAd() {
    const e = validateAd()
    if (Object.keys(e).length) { setAdErrors(e); return }
    setSaving(true)
    try {
      const payload = {
        client_id: id,
        platform: adForm.platform,
        date: adForm.date,
        spend: Number(adForm.spend) || 0,
        impressions: Number(adForm.impressions) || 0,
        clicks: Number(adForm.clicks) || 0,
        leads: Number(adForm.leads) || 0,
        conversions: Number(adForm.conversions) || 0,
        ctr: Number(adForm.ctr) || 0,
        cpl: Number(adForm.cpl) || 0,
        roas: Number(adForm.roas) || 0,
      }
      if (isDemoMode) {
        setAdEntries((prev) => [{ ...payload, id: `ad-${Date.now()}` }, ...prev].slice(0, 5))
      } else {
        const { data, error } = await supabase.from('ad_performance').insert(payload).select().single()
        if (error) throw error
        setAdEntries((prev) => [data, ...prev].slice(0, 5))
      }
      showToast('Ad performance entry saved')
      setAdForm(EMPTY_AD)
      setAdErrors({})
      setShowAdModal(false)
    } catch (err) {
      showToast(err.message ?? 'Failed to save ad performance', 'error')
    } finally {
      setSaving(false)
    }
  }

  // ── Messages ─────────────────────────────────────────────────────────────────
  async function handleSendMessage() {
    if (!messageText.trim()) return
    const content = messageText.trim()
    setMessageText('')
    setSaving(true)
    try {
      const payload = {
        client_id: id,
        sender_id: profile?.id ?? null,
        content,
      }
      if (!isDemoMode) {
        const { data, error } = await supabase
          .from('messages')
          .insert(payload)
          .select('*, sender:profiles!sender_id(full_name, role)')
          .single()
        if (error) throw error
        setMessages((prev) => (prev.some((m) => m.id === data.id) ? prev : [...prev, data]))

        // Find the client's user profile and push-notify them
        const { data: clientProfile } = await supabase
          .from('profiles')
          .select('id')
          .eq('client_id', id)
          .eq('role', 'client')
          .maybeSingle()

        if (clientProfile?.id) {
          sendPushNotification(clientProfile.id, {
            title: `New message from VirtueCore`,
            body: content.slice(0, 100),
            url: '/client/messages',
          })
        }
      } else {
        setMessages((prev) => [...prev, { ...payload, id: `m-${Date.now()}`, created_at: new Date().toISOString() }])
      }
    } catch (err) {
      showToast(err.message ?? 'Failed to send message', 'error')
      setMessageText(content)
    } finally {
      setSaving(false)
    }
  }

  const inputClass = 'border border-vc-border rounded px-3 py-2 w-full text-sm text-vc-text focus:outline-none focus:border-gold'
  const selectClass = inputClass

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
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={reportPeriod}
                onChange={(e) => setReportPeriod(e.target.value)}
                placeholder="e.g. March 2026"
                className="border border-vc-border px-3 py-2 text-sm text-vc-text focus:outline-none focus:border-gold w-36"
              />
              <button
                onClick={handleGenerateReport}
                disabled={reportLoading || !reportPeriod.trim()}
                className="flex items-center gap-1.5 bg-gold hover:bg-amber-600 disabled:opacity-60 text-white text-sm px-4 py-2 transition-colors whitespace-nowrap"
              >
                <Sparkles size={14} />
                {reportLoading ? 'Generating…' : 'Generate AI Report'}
              </button>
            </div>
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
          <LineChart data={trendData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#666666' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#666666' }} axisLine={false} tickLine={false} />
            <Tooltip />
            <Line type="monotone" dataKey="leads" stroke="#D4A843" strokeWidth={2} name="Leads" dot={{ r: 3 }} />
            <Line type="monotone" dataKey="cpl" stroke="#1A1A1A" strokeWidth={2} name="CPL (£)" dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Deliverables + Messages */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Deliverables */}
        <div className="border border-vc-border">
          <div className="px-4 py-3 border-b border-vc-border flex items-center justify-between">
            <h2 className="text-sm font-medium text-vc-text">Deliverables</h2>
            <button
              onClick={openAddDeliverable}
              className="flex items-center gap-1 text-xs text-vc-muted hover:text-vc-text transition-colors"
            >
              <Plus size={13} /> Add
            </button>
          </div>
          <div className="divide-y divide-vc-border">
            {deliverables.length === 0 && (
              <p className="px-4 py-4 text-sm text-vc-muted">No deliverables yet.</p>
            )}
            {deliverables.map((d) => (
              <div key={d.id} className="px-4 py-3 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-vc-text truncate">{d.title}</p>
                  <p className="text-xs text-vc-muted capitalize">{d.type.replace(/_/g, ' ')}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {d.file_url && (
                    <a href={d.file_url} target="_blank" rel="noreferrer" className="text-vc-muted hover:text-vc-text">
                      <ExternalLink size={13} />
                    </a>
                  )}
                  <Badge variant={d.status === 'approved' ? 'green' : d.status === 'changes_requested' ? 'red' : d.status === 'pending_review' ? 'amber' : 'default'}>
                    {d.status.replace(/_/g, ' ')}
                  </Badge>
                  <button onClick={() => openEditDeliverable(d)} className="text-vc-muted hover:text-vc-text">
                    <Pencil size={13} />
                  </button>
                  <button onClick={() => handleDeleteDeliverable(d.id)} className="text-vc-muted hover:text-red-500">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Messages */}
        <div className="border border-vc-border flex flex-col">
          <div className="px-4 py-3 border-b border-vc-border">
            <h2 className="text-sm font-medium text-vc-text">Messages</h2>
          </div>
          <div className="divide-y divide-vc-border max-h-72 overflow-y-auto flex-1">
            {messages.length === 0 && (
              <p className="px-4 py-4 text-sm text-vc-muted">No messages yet.</p>
            )}
            {messages.map((msg) => (
              <div key={msg.id} className={`px-4 py-3 ${msg.sender?.role === 'admin' ? 'bg-vc-secondary' : ''}`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium text-vc-text">{msg.sender?.full_name ?? (msg.sender_id === profile?.id ? profile?.full_name : 'Client')}</span>
                  <span className="text-xs text-vc-muted">
                    {new Date(msg.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="text-sm text-vc-text">{msg.content}</p>
              </div>
            ))}
            <div ref={messagesBottomRef} />
          </div>
          {/* Send message */}
          <div className="px-4 py-3 border-t border-vc-border flex gap-2">
            <input
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage() } }}
              placeholder="Write a message…"
              className="flex-1 border border-vc-border rounded px-3 py-2 text-sm text-vc-text focus:outline-none focus:border-gold"
            />
            <button
              onClick={handleSendMessage}
              disabled={!messageText.trim() || saving}
              className="bg-gold hover:bg-gold-dark text-white text-sm px-3 py-2 rounded disabled:opacity-50 flex items-center gap-1"
            >
              <Send size={13} />
            </button>
          </div>
        </div>
      </div>

      {/* Invoices */}
      <div className="border border-vc-border">
        <div className="px-5 py-3 border-b border-vc-border flex items-center justify-between">
          <h2 className="text-sm font-medium text-vc-text">Invoices</h2>
          <button
            onClick={openAddInvoice}
            className="flex items-center gap-1 text-xs text-vc-muted hover:text-vc-text transition-colors"
          >
            <Plus size={13} /> Add Invoice
          </button>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-vc-border bg-vc-secondary">
              <th className="text-left px-5 py-2.5 text-xs text-vc-muted font-medium">Type</th>
              <th className="text-left px-5 py-2.5 text-xs text-vc-muted font-medium">Amount</th>
              <th className="text-left px-5 py-2.5 text-xs text-vc-muted font-medium">Due</th>
              <th className="text-left px-5 py-2.5 text-xs text-vc-muted font-medium">Status</th>
              <th className="px-5 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {invoices.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-4 text-sm text-vc-muted">No invoices yet.</td>
              </tr>
            )}
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
                <td className="px-5 py-3">
                  <button onClick={() => openEditInvoice(inv)} className="text-vc-muted hover:text-vc-text">
                    <Pencil size={13} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Ad Performance */}
      <div className="border border-vc-border">
        <div className="px-5 py-3 border-b border-vc-border flex items-center justify-between">
          <h2 className="text-sm font-medium text-vc-text">Ad Performance — Manual Entry</h2>
          <button
            onClick={() => { setAdForm(EMPTY_AD); setAdErrors({}); setShowAdModal(true) }}
            className="flex items-center gap-1 text-xs text-vc-muted hover:text-vc-text transition-colors"
          >
            <Plus size={13} /> Log Entry
          </button>
        </div>
        {adEntries.length === 0 ? (
          <p className="px-5 py-4 text-sm text-vc-muted">No manual entries yet. Click Log Entry to add performance data.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-vc-border bg-vc-secondary">
                  <th className="text-left px-5 py-2.5 text-xs text-vc-muted font-medium">Platform</th>
                  <th className="text-left px-5 py-2.5 text-xs text-vc-muted font-medium">Date</th>
                  <th className="text-left px-5 py-2.5 text-xs text-vc-muted font-medium">Spend</th>
                  <th className="text-left px-5 py-2.5 text-xs text-vc-muted font-medium">Leads</th>
                  <th className="text-left px-5 py-2.5 text-xs text-vc-muted font-medium">CPL</th>
                  <th className="text-left px-5 py-2.5 text-xs text-vc-muted font-medium">ROAS</th>
                  <th className="text-left px-5 py-2.5 text-xs text-vc-muted font-medium">CTR</th>
                </tr>
              </thead>
              <tbody>
                {adEntries.map((a) => (
                  <tr key={a.id} className="border-b border-vc-border last:border-0">
                    <td className="px-5 py-3 capitalize text-vc-text">{a.platform}</td>
                    <td className="px-5 py-3 text-vc-muted">{a.date}</td>
                    <td className="px-5 py-3 text-vc-text">£{Number(a.spend).toLocaleString()}</td>
                    <td className="px-5 py-3 text-vc-text">{a.leads}</td>
                    <td className="px-5 py-3 text-vc-text">{a.cpl ? `£${a.cpl}` : '—'}</td>
                    <td className="px-5 py-3 text-vc-text">{a.roas ? `${a.roas}x` : '—'}</td>
                    <td className="px-5 py-3 text-vc-text">{a.ctr ? `${a.ctr}%` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Deliverable Modal ──────────────────────────────────────────────── */}
      <Modal
        isOpen={showDeliverableModal}
        onClose={() => setShowDeliverableModal(false)}
        title={editDeliverable ? 'Edit Deliverable' : 'Add Deliverable'}
        size="md"
      >
        <div className="space-y-4">
          <FormField label="Title" required error={deliverableErrors.title}>
            <input
              className={inputClass}
              value={deliverableForm.title}
              onChange={(e) => setDeliverableForm({ ...deliverableForm, title: e.target.value })}
              placeholder="e.g. March Ad Creatives Pack"
            />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Type" required>
              <select
                className={selectClass}
                value={deliverableForm.type}
                onChange={(e) => setDeliverableForm({ ...deliverableForm, type: e.target.value })}
              >
                <option value="ad_creative">Ad Creative</option>
                <option value="content_calendar">Content Calendar</option>
                <option value="report">Report</option>
                <option value="website">Website</option>
                <option value="lead_magnet">Lead Magnet</option>
                <option value="other">Other</option>
              </select>
            </FormField>

            <FormField label="Status" required>
              <select
                className={selectClass}
                value={deliverableForm.status}
                onChange={(e) => setDeliverableForm({ ...deliverableForm, status: e.target.value })}
              >
                <option value="draft">Draft</option>
                <option value="pending_review">Pending Review</option>
                <option value="approved">Approved</option>
              </select>
            </FormField>
          </div>

          <FormField label="File URL">
            <input
              className={inputClass}
              value={deliverableForm.file_url}
              onChange={(e) => setDeliverableForm({ ...deliverableForm, file_url: e.target.value })}
              placeholder="https://..."
            />
          </FormField>

          <FormField label="Upload File (PDF, image, zip, etc.)">
            <label className="flex items-center justify-center gap-2 border border-dashed border-vc-border rounded px-3 py-3 text-sm text-vc-muted hover:text-vc-text cursor-pointer">
              <Upload size={14} />
              <span>{deliverableFile ? deliverableFile.name : 'Choose file'}</span>
              <input
                type="file"
                className="hidden"
                onChange={(e) => setDeliverableFile(e.target.files?.[0] || null)}
              />
            </label>
            <p className="text-xs text-vc-muted mt-1">If you upload a file, it will be stored in-app and used instead of the URL above.</p>
          </FormField>

          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setShowDeliverableModal(false)} className="border border-vc-border text-vc-text text-sm px-4 py-2 rounded hover:bg-vc-secondary">
              Cancel
            </button>
            <button onClick={handleSaveDeliverable} disabled={saving} className="bg-gold hover:bg-gold-dark text-white text-sm px-4 py-2 rounded disabled:opacity-60">
              {saving ? (uploadingFile ? 'Uploading…' : 'Saving…') : editDeliverable ? 'Save Changes' : 'Add Deliverable'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Invoice Modal ──────────────────────────────────────────────────── */}
      <Modal
        isOpen={showInvoiceModal}
        onClose={() => setShowInvoiceModal(false)}
        title={editInvoice ? 'Edit Invoice' : 'Add Invoice'}
        size="md"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Amount (£)" required error={invoiceErrors.amount}>
              <input
                type="number"
                className={inputClass}
                value={invoiceForm.amount}
                onChange={(e) => setInvoiceForm({ ...invoiceForm, amount: e.target.value })}
                min="0"
              />
            </FormField>

            <FormField label="Type" required>
              <select
                className={selectClass}
                value={invoiceForm.type}
                onChange={(e) => setInvoiceForm({ ...invoiceForm, type: e.target.value })}
              >
                <option value="retainer">Retainer</option>
                <option value="commission">Commission</option>
              </select>
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Due Date" required error={invoiceErrors.due_date}>
              <input
                type="date"
                className={inputClass}
                value={invoiceForm.due_date}
                onChange={(e) => setInvoiceForm({ ...invoiceForm, due_date: e.target.value })}
              />
            </FormField>

            <FormField label="Status" required>
              <select
                className={selectClass}
                value={invoiceForm.status}
                onChange={(e) => setInvoiceForm({ ...invoiceForm, status: e.target.value })}
              >
                <option value="draft">Draft</option>
                <option value="sent">Sent</option>
                <option value="paid">Paid</option>
                <option value="overdue">Overdue</option>
              </select>
            </FormField>
          </div>

          <FormField label="Stripe Invoice ID (optional)">
            <input
              className={inputClass}
              value={invoiceForm.stripe_invoice_id}
              onChange={(e) => setInvoiceForm({ ...invoiceForm, stripe_invoice_id: e.target.value })}
              placeholder="in_..."
            />
          </FormField>

          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setShowInvoiceModal(false)} className="border border-vc-border text-vc-text text-sm px-4 py-2 rounded hover:bg-vc-secondary">
              Cancel
            </button>
            <button onClick={handleSaveInvoice} disabled={saving} className="bg-gold hover:bg-gold-dark text-white text-sm px-4 py-2 rounded disabled:opacity-60">
              {saving ? 'Saving…' : editInvoice ? 'Save Changes' : 'Add Invoice'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Ad Performance Modal ───────────────────────────────────────────── */}
      <Modal
        isOpen={showAdModal}
        onClose={() => setShowAdModal(false)}
        title="Log Ad Performance"
        size="lg"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Platform" required>
              <select
                className={selectClass}
                value={adForm.platform}
                onChange={(e) => setAdForm({ ...adForm, platform: e.target.value })}
              >
                <option value="meta">Meta</option>
                <option value="google">Google</option>
              </select>
            </FormField>

            <FormField label="Date" required error={adErrors.date}>
              <input
                type="date"
                className={inputClass}
                value={adForm.date}
                onChange={(e) => setAdForm({ ...adForm, date: e.target.value })}
              />
            </FormField>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <FormField label="Spend (£)" required error={adErrors.spend}>
              <input type="number" className={inputClass} value={adForm.spend} onChange={(e) => setAdForm({ ...adForm, spend: e.target.value })} min="0" />
            </FormField>
            <FormField label="Impressions">
              <input type="number" className={inputClass} value={adForm.impressions} onChange={(e) => setAdForm({ ...adForm, impressions: e.target.value })} min="0" />
            </FormField>
            <FormField label="Clicks">
              <input type="number" className={inputClass} value={adForm.clicks} onChange={(e) => setAdForm({ ...adForm, clicks: e.target.value })} min="0" />
            </FormField>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <FormField label="Leads">
              <input type="number" className={inputClass} value={adForm.leads} onChange={(e) => setAdForm({ ...adForm, leads: e.target.value })} min="0" />
            </FormField>
            <FormField label="Conversions">
              <input type="number" className={inputClass} value={adForm.conversions} onChange={(e) => setAdForm({ ...adForm, conversions: e.target.value })} min="0" />
            </FormField>
            <FormField label="CTR (%)">
              <input type="number" className={inputClass} value={adForm.ctr} onChange={(e) => setAdForm({ ...adForm, ctr: e.target.value })} min="0" step="0.01" />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="CPL (£)">
              <input type="number" className={inputClass} value={adForm.cpl} onChange={(e) => setAdForm({ ...adForm, cpl: e.target.value })} min="0" step="0.01" />
            </FormField>
            <FormField label="ROAS">
              <input type="number" className={inputClass} value={adForm.roas} onChange={(e) => setAdForm({ ...adForm, roas: e.target.value })} min="0" step="0.01" />
            </FormField>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setShowAdModal(false)} className="border border-vc-border text-vc-text text-sm px-4 py-2 rounded hover:bg-vc-secondary">
              Cancel
            </button>
            <button onClick={handleSaveAd} disabled={saving} className="bg-gold hover:bg-gold-dark text-white text-sm px-4 py-2 rounded disabled:opacity-60">
              {saving ? 'Saving…' : 'Save Entry'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
