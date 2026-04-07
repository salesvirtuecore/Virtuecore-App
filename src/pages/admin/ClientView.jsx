import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Sparkles, X, Pencil, Trash2, Plus, Send, Upload, ExternalLink } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import Badge from '../../components/ui/Badge'
import StatCard from '../../components/ui/StatCard'
import Modal from '../../components/ui/Modal'
import FormField from '../../components/ui/FormField'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../context/ToastContext'
import { useAuth } from '../../context/AuthContext'
import { sendPushNotification } from '../../lib/pushNotifications'
import { apiFetch } from '../../lib/api'
import { notifySlack } from '../../lib/slackNotify'

const HEALTH_BADGE = { green: 'green', amber: 'amber', red: 'red' }

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

  const [client, setClient] = useState(null)
  const [loadingClient, setLoadingClient] = useState(true)
  const [syncingRevenue, setSyncingRevenue] = useState(false)

  // Local data state
  const [deliverables, setDeliverables] = useState([])
  const [invoices, setInvoices] = useState([])
  const [adEntries, setAdEntries] = useState([])
  const [npsData, setNpsData] = useState([])
  const [messages, setMessages] = useState([])

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
    if (!supabase) return

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
          { data: npsRows },
        ] = await Promise.all([
          supabase.from('clients').select('id, company_name, contact_name, contact_email, package_tier, monthly_retainer, revenue_share_percentage, status, health_score, meta_ad_account_id, stripe_account_id, stripe_total_revenue, stripe_revenue_synced_at').eq('id', id).maybeSingle(),
          supabase.from('deliverables').select('id, client_id, title, type, file_url, status, feedback, created_at').eq('client_id', id).order('created_at', { ascending: false }),
          supabase.from('invoices').select('id, client_id, amount, type, due_date, paid_date, status, created_at').eq('client_id', id).order('created_at', { ascending: false }),
          supabase.from('messages').select('*, sender:profiles!sender_id(full_name, role)').eq('client_id', id).order('created_at', { ascending: true }),
          supabase.from('ad_performance').select('date, spend, leads, clicks, impressions, conversions, cpl, ctr, roas, client_id, platform, created_at').eq('client_id', id).order('date', { ascending: true }),
          supabase.from('nps_responses').select('score,comment,created_at').eq('client_id', id).order('created_at', { ascending: false }).limit(12),
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
        setNpsData(npsRows || [])
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
    if (!supabase) return
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
  }, [id, profile?.id, profile?.full_name])

  // Scroll messages to bottom
  useEffect(() => {
    messagesBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  if (loadingClient) {
    return (
      <div className="p-6">
        <button onClick={() => navigate('/admin/clients')} className="flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary mb-4">
          <ArrowLeft size={14} /> Back to Clients
        </button>
        <p className="text-sm text-text-secondary">Loading client...</p>
      </div>
    )
  }

  if (!client) {
    return (
      <div className="p-6">
        <button onClick={() => navigate('/admin/clients')} className="flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary mb-4">
          <ArrowLeft size={14} /> Back to Clients
        </button>
        <p className="text-sm text-text-secondary">Client not found.</p>
      </div>
    )
  }

  const totalAdSpend = adEntries.reduce((sum, row) => sum + Number(row.spend || 0), 0)
  const totalLeads = adEntries.reduce((sum, row) => sum + Number(row.leads || 0), 0)
  const weightedRoasNumerator = adEntries.reduce((sum, row) => sum + Number(row.spend || 0) * Number(row.roas || 0), 0)
  const fallbackPerformance = { ad_spend: 0, leads: 0, cpl: 0, roas: 0 }
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
  })) : []

  // ── Sync Stripe Revenue ──────────────────────────────────────────────────────
  async function handleSyncRevenue() {
    if (!client?.stripe_account_id) {
      showToast('Client has not connected their Stripe account yet', 'error')
      return
    }
    setSyncingRevenue(true)
    try {
      const res = await apiFetch('/api/stripe/sync-revenue', {
        method: 'POST',
        body: JSON.stringify({ client_id: client.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Sync failed')
      setClient((prev) => ({
        ...prev,
        stripe_total_revenue: data.total_revenue,
        stripe_revenue_synced_at: new Date().toISOString(),
      }))
      showToast(`Synced ${data.charge_count} charges — total £${Number(data.total_revenue).toLocaleString()}`)
    } catch (err) {
      showToast(err.message ?? 'Sync failed', 'error')
    } finally {
      setSyncingRevenue(false)
    }
  }

  // ── Generate Report ──────────────────────────────────────────────────────────
  async function handleGenerateReport() {
    setReportLoading(true)
    try {
      const res = await apiFetch('/api/admin/generate-report', {
        method: 'POST',
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
        resolvedFileUrl = await uploadDeliverableToStorage(deliverableFile)
      }

      const payload = {
        title: deliverableForm.title.trim(),
        type: deliverableForm.type,
        file_url: resolvedFileUrl,
        status: deliverableForm.status,
        client_id: id,
      }
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

        // Auto-import content calendar PDFs
        if (payload.type === 'content_calendar' && payload.file_url) {
          apiFetch('/api/admin/parse-content-plan', {
            method: 'POST',
            body: JSON.stringify({ client_id: id, file_url: payload.file_url, title: payload.title }),
          }).then(async (r) => {
            const result = await r.json()
            if (r.ok) showToast(`Content plan imported — ${result.posts_imported} posts added to calendar`)
            else showToast(`Calendar import failed: ${result.error}`, 'error')
          })
        }

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
      const { error } = await supabase.from('deliverables').delete().eq('id', delId)
      if (error) throw error
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
      }
      if (editInvoice) {
        const { error } = await supabase.from('invoices').update(payload).eq('id', editInvoice.id)
        if (error) throw error
        setInvoices((prev) => prev.map((i) => (i.id === editInvoice.id ? { ...i, ...payload } : i)))
      } else {
        const { data, error } = await supabase.from('invoices').insert(payload).select().single()
        if (error) throw error
        setInvoices((prev) => [...prev, data])
        notifySlack('invoice_created', { amount: payload.amount, type: payload.type, client_name: client.company_name, due_date: payload.due_date })

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
      const { data, error } = await supabase.from('ad_performance').insert(payload).select().single()
      if (error) throw error
      setAdEntries((prev) => [data, ...prev].slice(0, 5))
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
        sender_name: profile?.full_name ?? null,
        sender_role: 'admin',
        content,
      }
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
    } catch (err) {
      showToast(err.message ?? 'Failed to send message', 'error')
      setMessageText(content)
    } finally {
      setSaving(false)
    }
  }

  const inputClass = 'bg-bg-tertiary border border-white/[0.08] rounded-btn px-3 py-2 w-full text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-vc-primary focus:ring-1 focus:ring-vc-primary'
  const selectClass = inputClass

  return (
    <div className="p-6 space-y-6">
      {/* Report toast */}
      {reportToast && (
        <div className="fixed top-4 right-4 z-50 bg-vc-primary text-white text-sm px-4 py-3 shadow-md flex items-center gap-2">
          <Sparkles size={14} className="text-vc-accent" />
          Report generated and saved to deliverables.
        </div>
      )}

      {/* Report modal */}
      {reportModal && (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4" onClick={() => setReportModal(null)}>
          <div
            className="bg-bg-elevated w-full max-w-2xl max-h-[80vh] flex flex-col border border-white/[0.08] rounded-card shadow-elevated"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06] flex-shrink-0">
              <div>
                <h3 className="text-sm font-semibold text-text-primary">AI-Generated Report Preview</h3>
                {reportModal.saved && (
                  <p className="text-xs text-status-success mt-0.5">Saved to deliverables as draft</p>
                )}
              </div>
              <button onClick={() => setReportModal(null)} className="text-text-secondary hover:text-text-primary">
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <pre className="text-sm text-text-primary whitespace-pre-wrap font-sans leading-relaxed">
                {reportModal.text}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* Back + header */}
      <div>
        <button onClick={() => navigate('/admin/clients')} className="flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary mb-3 transition-colors">
          <ArrowLeft size={14} /> Back to Clients
        </button>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-h2 font-heading text-text-primary">{client.company_name}</h1>
            <p className="text-sm text-text-secondary">{client.contact_name} · {client.contact_email}</p>
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
                className="border border-white/[0.06] px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-vc-primary w-36"
              />
              <button
                onClick={handleGenerateReport}
                disabled={reportLoading || !reportPeriod.trim()}
                className="flex items-center gap-1.5 bg-vc-primary hover:bg-amber-600 disabled:opacity-60 text-white text-sm px-4 py-2 transition-colors whitespace-nowrap"
              >
                <Sparkles size={14} />
                {reportLoading ? 'Generating…' : 'Generate AI Report'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Admin-only note */}
      <div className="bg-status-warning/10 border border-status-warning/20 px-4 py-3 text-sm text-amber-800">
        <span className="font-medium">Admin view:</span> You are viewing this client's portal. Internal notes and full data visible.
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Ad Spend (Mar)" value={`£${metrics.ad_spend.toLocaleString()}`} />
        <StatCard label="Leads (Mar)" value={metrics.leads} />
        <StatCard label="CPL" value={`£${metrics.cpl}`} />
        <StatCard label="ROAS" value={`${metrics.roas}x`} />
      </div>

      {/* Stripe Revenue (since joining VirtueCore) */}
      <div className="vc-card">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-medium text-text-secondary">Stripe revenue since joining VirtueCore</h2>
            <p className="text-3xl font-semibold text-text-primary mt-1">
              £{Number(client?.stripe_total_revenue || 0).toLocaleString()}
            </p>
            <p className="text-xs text-text-secondary mt-1">
              {client?.stripe_account_id
                ? client?.stripe_revenue_synced_at
                  ? `Last synced ${new Date(client.stripe_revenue_synced_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}`
                  : 'Not yet synced'
                : 'Client has not connected their Stripe account yet'}
            </p>
            {client?.stripe_account_id && Number(client?.revenue_share_percentage || 0) > 0 && (
              <p className="text-xs text-text-primary mt-2">
                Estimated commission ({client.revenue_share_percentage}%):{' '}
                <span className="font-semibold">
                  £{Math.round(Number(client?.stripe_total_revenue || 0) * Number(client.revenue_share_percentage) / 100).toLocaleString()}
                </span>
              </p>
            )}
          </div>
          {client?.stripe_account_id && (
            <button
              onClick={handleSyncRevenue}
              disabled={syncingRevenue}
              className="text-xs px-3 py-2 bg-vc-primary text-white hover:bg-vc-accent rounded transition-colors disabled:opacity-60 flex-shrink-0"
            >
              {syncingRevenue ? 'Syncing...' : 'Sync now'}
            </button>
          )}
        </div>
      </div>

      {/* Performance chart */}
      <div className="vc-card">
        <h2 className="text-sm font-medium text-text-primary mb-4">Performance Trend (6 months)</h2>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={trendData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#5A5A5E" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "#5A5A5E" }} axisLine={false} tickLine={false} />
            <Tooltip />
            <Line type="monotone" dataKey="leads" stroke="#D4A843" strokeWidth={2} name="Leads" dot={{ r: 3 }} />
            <Line type="monotone" dataKey="cpl" stroke="#1A1A1A" strokeWidth={2} name="CPL (£)" dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* NPS / Client Feedback */}
      {npsData.length > 0 && (() => {
        const avg = Math.round(npsData.reduce((s, r) => s + r.score, 0) / npsData.length * 10) / 10
        const sentimentColor = (s) => s >= 9 ? 'text-status-success bg-status-success/10 border-status-success/20' : s >= 7 ? 'text-status-warning bg-status-warning/10 border-status-warning/20' : 'text-status-danger bg-status-danger/10 border-status-danger/20'
        const sentimentLabel = (s) => s >= 9 ? 'Promoter' : s >= 7 ? 'Passive' : 'Detractor'
        return (
          <div className="border border-white/[0.06]">
            <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
              <h2 className="text-sm font-medium text-text-primary">Client Feedback (NPS)</h2>
              <div className="flex items-center gap-3">
                <span className="text-xs text-text-secondary">{npsData.length} response{npsData.length !== 1 ? 's' : ''}</span>
                <span className="text-xs font-semibold text-text-primary">Avg: {avg}/10</span>
              </div>
            </div>
            <div className="divide-y divide-white/[0.06]">
              {npsData.map((r, i) => (
                <div key={i} className="px-4 py-3 flex items-start gap-3">
                  <span className={`text-xs font-bold border px-2 py-1 flex-shrink-0 rounded ${sentimentColor(r.score)}`}>{r.score}/10</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`text-xs font-medium ${sentimentColor(r.score).split(' ')[0]}`}>{sentimentLabel(r.score)}</span>
                      <span className="text-xs text-text-secondary">{new Date(r.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    </div>
                    {r.comment ? <p className="text-sm text-text-primary">{r.comment}</p> : <p className="text-xs text-text-secondary italic">No comment left</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })()}

      {/* Deliverables + Messages */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Deliverables */}
        <div className="border border-white/[0.06]">
          <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
            <h2 className="text-sm font-medium text-text-primary">Deliverables</h2>
            <button
              onClick={openAddDeliverable}
              className="flex items-center gap-1 text-xs text-text-secondary hover:text-text-primary transition-colors"
            >
              <Plus size={13} /> Add
            </button>
          </div>
          <div className="divide-y divide-white/[0.06]">
            {deliverables.length === 0 && (
              <p className="px-4 py-4 text-sm text-text-secondary">No deliverables yet.</p>
            )}
            {deliverables.map((d) => (
              <div key={d.id} className="px-4 py-3 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-text-primary truncate">{d.title}</p>
                  <p className="text-xs text-text-secondary capitalize">{d.type.replace(/_/g, ' ')}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {d.file_url && (
                    <a href={d.file_url} target="_blank" rel="noreferrer" className="text-text-secondary hover:text-text-primary">
                      <ExternalLink size={13} />
                    </a>
                  )}
                  <Badge variant={d.status === 'approved' ? 'green' : d.status === 'changes_requested' ? 'red' : d.status === 'pending_review' ? 'amber' : 'default'}>
                    {d.status.replace(/_/g, ' ')}
                  </Badge>
                  <button onClick={() => openEditDeliverable(d)} className="text-text-secondary hover:text-text-primary">
                    <Pencil size={13} />
                  </button>
                  <button onClick={() => handleDeleteDeliverable(d.id)} className="text-text-secondary hover:text-status-danger">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Messages */}
        <div className="border border-white/[0.06] flex flex-col">
          <div className="px-4 py-3 border-b border-white/[0.06]">
            <h2 className="text-sm font-medium text-text-primary">Messages</h2>
          </div>
          <div className="divide-y divide-white/[0.06] max-h-72 overflow-y-auto flex-1">
            {messages.length === 0 && (
              <p className="px-4 py-4 text-sm text-text-secondary">No messages yet.</p>
            )}
            {messages.map((msg) => (
              <div key={msg.id} className={`px-4 py-3 ${msg.sender?.role === 'admin' ? 'bg-bg-tertiary' : ''}`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium text-text-primary">{msg.sender?.full_name ?? (msg.sender_id === profile?.id ? profile?.full_name : 'Client')}</span>
                  <span className="text-xs text-text-secondary">
                    {new Date(msg.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="text-sm text-text-primary">{msg.content}</p>
              </div>
            ))}
            <div ref={messagesBottomRef} />
          </div>
          {/* Send message */}
          <div className="px-4 py-3 border-t border-white/[0.06] flex gap-2">
            <input
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage() } }}
              placeholder="Write a message…"
              className="flex-1 border border-white/[0.06] rounded px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-vc-primary"
            />
            <button
              onClick={handleSendMessage}
              disabled={!messageText.trim() || saving}
              className="bg-vc-primary hover:bg-vc-accent text-white text-sm px-3 py-2 rounded disabled:opacity-50 flex items-center gap-1"
            >
              <Send size={13} />
            </button>
          </div>
        </div>
      </div>

      {/* Invoices */}
      <div className="border border-white/[0.06]">
        <div className="px-5 py-3 border-b border-white/[0.06] flex items-center justify-between">
          <h2 className="text-sm font-medium text-text-primary">Invoices</h2>
          <button
            onClick={openAddInvoice}
            className="flex items-center gap-1 text-xs text-text-secondary hover:text-text-primary transition-colors"
          >
            <Plus size={13} /> Add Invoice
          </button>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/[0.06] bg-bg-tertiary">
              <th className="text-left px-5 py-2.5 text-xs text-text-secondary font-medium">Type</th>
              <th className="text-left px-5 py-2.5 text-xs text-text-secondary font-medium">Amount</th>
              <th className="text-left px-5 py-2.5 text-xs text-text-secondary font-medium">Due</th>
              <th className="text-left px-5 py-2.5 text-xs text-text-secondary font-medium">Status</th>
              <th className="px-5 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {invoices.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-4 text-sm text-text-secondary">No invoices yet.</td>
              </tr>
            )}
            {invoices.map((inv) => (
              <tr key={inv.id} className="border-b border-white/[0.06] last:border-0">
                <td className="px-5 py-3 capitalize text-text-primary">{inv.type}</td>
                <td className="px-5 py-3 font-medium text-text-primary">£{inv.amount.toLocaleString()}</td>
                <td className="px-5 py-3 text-text-secondary">{inv.due_date}</td>
                <td className="px-5 py-3">
                  <Badge variant={inv.status === 'paid' ? 'green' : inv.status === 'overdue' ? 'red' : inv.status === 'sent' ? 'blue' : 'default'}>
                    {inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}
                  </Badge>
                </td>
                <td className="px-5 py-3">
                  <button onClick={() => openEditInvoice(inv)} className="text-text-secondary hover:text-text-primary">
                    <Pencil size={13} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Ad Performance */}
      <div className="border border-white/[0.06]">
        <div className="px-5 py-3 border-b border-white/[0.06] flex items-center justify-between">
          <h2 className="text-sm font-medium text-text-primary">Ad Performance — Manual Entry</h2>
          <button
            onClick={() => { setAdForm(EMPTY_AD); setAdErrors({}); setShowAdModal(true) }}
            className="flex items-center gap-1 text-xs text-text-secondary hover:text-text-primary transition-colors"
          >
            <Plus size={13} /> Log Entry
          </button>
        </div>
        {adEntries.length === 0 ? (
          <p className="px-5 py-4 text-sm text-text-secondary">No manual entries yet. Click Log Entry to add performance data.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] bg-bg-tertiary">
                  <th className="text-left px-5 py-2.5 text-xs text-text-secondary font-medium">Platform</th>
                  <th className="text-left px-5 py-2.5 text-xs text-text-secondary font-medium">Date</th>
                  <th className="text-left px-5 py-2.5 text-xs text-text-secondary font-medium">Spend</th>
                  <th className="text-left px-5 py-2.5 text-xs text-text-secondary font-medium">Leads</th>
                  <th className="text-left px-5 py-2.5 text-xs text-text-secondary font-medium">CPL</th>
                  <th className="text-left px-5 py-2.5 text-xs text-text-secondary font-medium">ROAS</th>
                  <th className="text-left px-5 py-2.5 text-xs text-text-secondary font-medium">CTR</th>
                </tr>
              </thead>
              <tbody>
                {adEntries.map((a) => (
                  <tr key={a.id} className="border-b border-white/[0.06] last:border-0">
                    <td className="px-5 py-3 capitalize text-text-primary">{a.platform}</td>
                    <td className="px-5 py-3 text-text-secondary">{a.date}</td>
                    <td className="px-5 py-3 text-text-primary">£{Number(a.spend).toLocaleString()}</td>
                    <td className="px-5 py-3 text-text-primary">{a.leads}</td>
                    <td className="px-5 py-3 text-text-primary">{a.cpl ? `£${a.cpl}` : '—'}</td>
                    <td className="px-5 py-3 text-text-primary">{a.roas ? `${a.roas}x` : '—'}</td>
                    <td className="px-5 py-3 text-text-primary">{a.ctr ? `${a.ctr}%` : '—'}</td>
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
            <label className="flex items-center justify-center gap-2 border border-dashed border-white/[0.06] rounded px-3 py-3 text-sm text-text-secondary hover:text-text-primary cursor-pointer">
              <Upload size={14} />
              <span>{deliverableFile ? deliverableFile.name : 'Choose file'}</span>
              <input
                type="file"
                className="hidden"
                onChange={(e) => setDeliverableFile(e.target.files?.[0] || null)}
              />
            </label>
            <p className="text-xs text-text-secondary mt-1">If you upload a file, it will be stored in-app and used instead of the URL above.</p>
          </FormField>

          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setShowDeliverableModal(false)} className="border border-white/[0.06] text-text-primary text-sm px-4 py-2 rounded hover:bg-bg-tertiary">
              Cancel
            </button>
            <button onClick={handleSaveDeliverable} disabled={saving} className="bg-vc-primary hover:bg-vc-accent text-white text-sm px-4 py-2 rounded disabled:opacity-60">
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
            <button onClick={() => setShowInvoiceModal(false)} className="border border-white/[0.06] text-text-primary text-sm px-4 py-2 rounded hover:bg-bg-tertiary">
              Cancel
            </button>
            <button onClick={handleSaveInvoice} disabled={saving} className="bg-vc-primary hover:bg-vc-accent text-white text-sm px-4 py-2 rounded disabled:opacity-60">
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
            <button onClick={() => setShowAdModal(false)} className="border border-white/[0.06] text-text-primary text-sm px-4 py-2 rounded hover:bg-bg-tertiary">
              Cancel
            </button>
            <button onClick={handleSaveAd} disabled={saving} className="bg-vc-primary hover:bg-vc-accent text-white text-sm px-4 py-2 rounded disabled:opacity-60">
              {saving ? 'Saving…' : 'Save Entry'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
