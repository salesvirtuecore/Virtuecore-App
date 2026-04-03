import { useState, useEffect } from 'react'
import { Plus } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import Badge from '../../components/ui/Badge'
import StatCard from '../../components/ui/StatCard'
import Modal from '../../components/ui/Modal'
import FormField from '../../components/ui/FormField'
import { DEMO_CLIENTS, DEMO_INVOICES, DEMO_BUSINESS_METRICS } from '../../data/placeholder'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../context/ToastContext'
import { useAuth } from '../../context/AuthContext'

const MONTHLY_REV = [
  { month: 'Oct', retainer: 8500, commission: 620 },
  { month: 'Nov', retainer: 9500, commission: 740 },
  { month: 'Dec', retainer: 9500, commission: 680 },
  { month: 'Jan', retainer: 11000, commission: 890 },
  { month: 'Feb', retainer: 11500, commission: 960 },
  { month: 'Mar', retainer: 12500, commission: 1040 },
]

const EMPTY_INVOICE_FORM = {
  client_id: '',
  amount: '',
  type: 'retainer',
  due_date: '',
  status: 'draft',
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-bg-elevated border border-white/[0.08] rounded px-3 py-2 text-xs shadow-elevated">
      <p className="text-text-secondary mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="font-mono-data font-semibold" style={{ color: p.fill }}>
          {p.name === 'retainer' ? 'Retainer' : 'Commission'}: £{p.value.toLocaleString()}
        </p>
      ))}
    </div>
  )
}

export default function Revenue() {
  const { isDemo } = useAuth()
  const { showToast } = useToast()
  const [clients, setClients] = useState(isDemo ? DEMO_CLIENTS : [])
  const [invoices, setInvoices] = useState(isDemo ? DEMO_INVOICES : [])
  const [showInvoiceModal, setShowInvoiceModal] = useState(false)
  const [invoiceForm, setInvoiceForm] = useState(EMPTY_INVOICE_FORM)
  const [invoiceErrors, setInvoiceErrors] = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (isDemo) return
    async function load() {
      const [{ data: clientData }, { data: invoiceData }] = await Promise.all([
        supabase.from('clients').select('id, status, company_name, monthly_retainer, ad_spend_managed, revenue_share_percentage'),
        supabase.from('invoices').select('*, clients(company_name)'),
      ])
      if (clientData) setClients(clientData)
      if (invoiceData) {
        setInvoices(invoiceData.map((i) => ({ ...i, client_name: i.clients?.company_name ?? i.client_name })))
      }
    }
    load()
  }, [])

  const activeClients = clients.filter((c) => c.status === 'active')
  const totalRetainer = activeClients.reduce((s, c) => s + c.monthly_retainer, 0)
  const totalOutstanding = invoices.filter((i) => i.status === 'overdue').reduce((s, i) => s + i.amount, 0)
  const m = DEMO_BUSINESS_METRICS

  function validateInvoice() {
    const e = {}
    if (!invoiceForm.client_id) e.client_id = 'Client is required'
    if (!invoiceForm.amount || isNaN(Number(invoiceForm.amount))) e.amount = 'Valid amount required'
    if (!invoiceForm.due_date) e.due_date = 'Due date is required'
    return e
  }

  async function handleSaveInvoice() {
    const e = validateInvoice()
    if (Object.keys(e).length) { setInvoiceErrors(e); return }
    setSaving(true)
    try {
      const client = clients.find((c) => c.id === invoiceForm.client_id)
      const payload = {
        client_id: invoiceForm.client_id,
        client_name: client?.company_name ?? '',
        amount: Number(invoiceForm.amount),
        type: invoiceForm.type,
        due_date: invoiceForm.due_date,
        status: invoiceForm.status,
      }

      if (isDemo) {
        setInvoices((prev) => [
          ...prev,
          { ...payload, id: `inv-${Date.now()}`, paid_date: null, created_at: new Date().toISOString().split('T')[0] },
        ])
      } else {
        const { data, error } = await supabase.from('invoices').insert(payload).select().single()
        if (error) throw error
        setInvoices((prev) => [...prev, { ...data, client_name: client?.company_name ?? '' }])
      }

      showToast('Invoice created')
      setShowInvoiceModal(false)
      setInvoiceForm(EMPTY_INVOICE_FORM)
    } catch (err) {
      showToast(err.message ?? 'Failed to create invoice', 'error')
    } finally {
      setSaving(false)
    }
  }

  const inputClass = 'bg-bg-tertiary border border-white/[0.08] rounded-btn px-3 py-2 w-full text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-vc-primary focus:ring-1 focus:ring-vc-primary'

  return (
    <div className="p-6 space-y-6 max-w-[1440px] mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-h2 font-heading text-text-primary">Revenue</h1>
          <p className="text-sm text-text-secondary mt-0.5">Retainer + commission tracking</p>
        </div>
        <button
          onClick={() => { setInvoiceForm(EMPTY_INVOICE_FORM); setInvoiceErrors({}); setShowInvoiceModal(true) }}
          className="bg-vc-primary hover:bg-vc-accent text-white text-sm px-4 py-2 rounded-btn flex items-center gap-2 transition-colors"
        >
          <Plus size={14} />
          Add Invoice
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Monthly Recurring Revenue" value={`£${totalRetainer.toLocaleString()}`} trend={m.mrr_change} />
        <StatCard label="Retainer Revenue" value={`£${totalRetainer.toLocaleString()}`} sub={`${activeClients.length} active clients`} />
        <StatCard label="Outstanding Invoices" value={`£${totalOutstanding.toLocaleString()}`} sub={`${invoices.filter((i) => i.status === 'overdue').length} overdue`} />
      </div>

      {/* Revenue chart */}
      <div className="vc-card">
        <h2 className="text-sm font-semibold text-text-primary font-heading mb-4">Revenue Breakdown</h2>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={MONTHLY_REV} barCategoryGap="30%">
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#5A5A5E' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#5A5A5E' }} axisLine={false} tickLine={false} tickFormatter={(v) => `£${v / 1000}k`} width={40} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="retainer" fill="#6C5CE7" name="retainer" radius={[2, 2, 0, 0]} isAnimationActive animationBegin={0} animationDuration={800} animationEasing="ease-out" />
            <Bar dataKey="commission" fill="#A29BFE" name="commission" radius={[2, 2, 0, 0]} isAnimationActive animationBegin={100} animationDuration={800} animationEasing="ease-out" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Revenue per client */}
      <div className="vc-card p-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-white/[0.06]">
          <h2 className="text-sm font-semibold text-text-primary font-heading">Revenue per Client</h2>
        </div>
        <table className="vc-table">
          <thead>
            <tr>
              <th>Client</th><th>Package</th><th>Retainer</th><th>Rev Share %</th><th>Est. Commission</th><th>Total MRR</th>
            </tr>
          </thead>
          <tbody>
            {clients.filter((c) => c.status !== 'churned').map((c) => {
              const commission = c.revenue_share_percentage > 0
                ? Math.round(c.ad_spend_managed * (c.revenue_share_percentage / 100))
                : 0
              const total = c.monthly_retainer + commission
              return (
                <tr key={c.id}>
                  <td className="font-medium text-text-primary">{c.company_name}</td>
                  <td className="text-text-secondary">{c.package_tier}</td>
                  <td className="mono">£{c.monthly_retainer.toLocaleString()}</td>
                  <td className="text-text-secondary">{c.revenue_share_percentage > 0 ? `${c.revenue_share_percentage}%` : '—'}</td>
                  <td className="mono">{commission > 0 ? `£${commission.toLocaleString()}` : '—'}</td>
                  <td className="mono font-semibold">£{total.toLocaleString()}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Invoice list */}
      <div className="vc-card p-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-white/[0.06]">
          <h2 className="text-sm font-semibold text-text-primary font-heading">Invoice History</h2>
        </div>
        <table className="vc-table">
          <thead>
            <tr>
              <th>Client</th><th>Type</th><th>Amount</th><th>Due</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv) => (
              <tr key={inv.id}>
                <td className="font-medium text-text-primary">{inv.client_name}</td>
                <td className="capitalize text-text-secondary">{inv.type}</td>
                <td className="mono">£{inv.amount.toLocaleString()}</td>
                <td className="text-text-secondary">{inv.due_date}</td>
                <td>
                  <Badge variant={inv.status === 'paid' ? 'green' : inv.status === 'overdue' ? 'red' : inv.status === 'sent' ? 'blue' : 'default'} dot>
                    {inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}
                  </Badge>
                </td>
              </tr>
            ))}
            {invoices.length === 0 && (
              <tr><td colSpan={5} className="px-5 py-6 text-center text-sm text-text-secondary">No invoices yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add Invoice Modal */}
      <Modal isOpen={showInvoiceModal} onClose={() => setShowInvoiceModal(false)} title="Add Invoice" size="md">
        <div className="space-y-4">
          <FormField label="Client" required error={invoiceErrors.client_id}>
            <select className={inputClass} value={invoiceForm.client_id} onChange={(e) => setInvoiceForm({ ...invoiceForm, client_id: e.target.value })}>
              <option value="">Select client…</option>
              {clients.filter((c) => c.status !== 'churned').map((c) => (
                <option key={c.id} value={c.id}>{c.company_name}</option>
              ))}
            </select>
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Amount (£)" required error={invoiceErrors.amount}>
              <input type="number" className={inputClass} value={invoiceForm.amount} onChange={(e) => setInvoiceForm({ ...invoiceForm, amount: e.target.value })} min="0" />
            </FormField>
            <FormField label="Type" required>
              <select className={inputClass} value={invoiceForm.type} onChange={(e) => setInvoiceForm({ ...invoiceForm, type: e.target.value })}>
                <option value="retainer">Retainer</option>
                <option value="commission">Commission</option>
              </select>
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Due Date" required error={invoiceErrors.due_date}>
              <input type="date" className={inputClass} value={invoiceForm.due_date} onChange={(e) => setInvoiceForm({ ...invoiceForm, due_date: e.target.value })} />
            </FormField>
            <FormField label="Status" required>
              <select className={inputClass} value={invoiceForm.status} onChange={(e) => setInvoiceForm({ ...invoiceForm, status: e.target.value })}>
                <option value="draft">Draft</option>
                <option value="sent">Sent</option>
                <option value="paid">Paid</option>
                <option value="overdue">Overdue</option>
              </select>
            </FormField>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setShowInvoiceModal(false)} className="border border-white/[0.08] text-text-secondary text-sm px-4 py-2 rounded-btn hover:bg-bg-tertiary transition-colors">Cancel</button>
            <button onClick={handleSaveInvoice} disabled={saving} className="bg-vc-primary hover:bg-vc-accent text-white text-sm px-4 py-2 rounded-btn disabled:opacity-60 transition-colors">{saving ? 'Saving…' : 'Create Invoice'}</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
