import { useState, useEffect } from 'react'
import { Plus } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import Badge from '../../components/ui/Badge'
import StatCard from '../../components/ui/StatCard'
import Modal from '../../components/ui/Modal'
import FormField from '../../components/ui/FormField'
import { DEMO_CLIENTS, DEMO_INVOICES, DEMO_BUSINESS_METRICS } from '../../data/placeholder'
import { isDemoMode, supabase } from '../../lib/supabase'
import { useToast } from '../../context/ToastContext'

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

export default function Revenue() {
  const { showToast } = useToast()
  const [clients, setClients] = useState(DEMO_CLIENTS)
  const [invoices, setInvoices] = useState(DEMO_INVOICES)
  const [showInvoiceModal, setShowInvoiceModal] = useState(false)
  const [invoiceForm, setInvoiceForm] = useState(EMPTY_INVOICE_FORM)
  const [invoiceErrors, setInvoiceErrors] = useState({})
  const [saving, setSaving] = useState(false)

  // In live mode, load clients and invoices from Supabase
  useEffect(() => {
    if (isDemoMode) return
    async function load() {
      const [{ data: clientData }, { data: invoiceData }] = await Promise.all([
        supabase.from('clients').select('*'),
        supabase.from('invoices').select('*, clients(company_name)'),
      ])
      if (clientData) setClients(clientData)
      if (invoiceData) {
        setInvoices(
          invoiceData.map((i) => ({
            ...i,
            client_name: i.clients?.company_name ?? i.client_name,
          }))
        )
      }
    }
    load()
  }, [])

  const activeClients = clients.filter((c) => c.status === 'active')
  const totalRetainer = activeClients.reduce((s, c) => s + c.monthly_retainer, 0)
  const totalOutstanding = invoices.filter((i) => i.status === 'overdue').reduce((s, i) => s + i.amount, 0)
  const m = DEMO_BUSINESS_METRICS

  // ── Add Invoice ──────────────────────────────────────────────────────────────
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

      if (isDemoMode) {
        setInvoices((prev) => [
          ...prev,
          { ...payload, id: `inv-${Date.now()}`, paid_date: null, created_at: new Date().toISOString().split('T')[0] },
        ])
      } else {
        const { data, error } = await supabase.from('invoices').insert(payload).select().single()
        if (error) throw error
        setInvoices((prev) => [
          ...prev,
          { ...data, client_name: client?.company_name ?? '' },
        ])
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

  const inputClass = 'border border-vc-border rounded px-3 py-2 w-full text-sm text-vc-text focus:outline-none focus:border-gold'
  const selectClass = inputClass

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-vc-text">Revenue</h1>
          <p className="text-sm text-vc-muted mt-0.5">Retainer + commission tracking</p>
        </div>
        <button
          onClick={() => { setInvoiceForm(EMPTY_INVOICE_FORM); setInvoiceErrors({}); setShowInvoiceModal(true) }}
          className="bg-gold hover:bg-gold-dark text-white text-sm px-4 py-2 rounded flex items-center gap-2"
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
      <div className="border border-vc-border p-5">
        <h2 className="text-sm font-medium text-vc-text mb-4">Revenue Breakdown</h2>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={MONTHLY_REV} barCategoryGap="30%">
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#666666' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#666666' }} axisLine={false} tickLine={false} tickFormatter={(v) => `£${v / 1000}k`} />
            <Tooltip formatter={(v, name) => [`£${v.toLocaleString()}`, name === 'retainer' ? 'Retainer' : 'Commission']} />
            <Bar dataKey="retainer" fill="#1A1A1A" name="retainer" />
            <Bar dataKey="commission" fill="#D4A843" name="commission" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Revenue per client */}
      <div className="border border-vc-border">
        <div className="px-5 py-3 border-b border-vc-border">
          <h2 className="text-sm font-medium text-vc-text">Revenue per Client</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-vc-border bg-vc-secondary">
              <th className="text-left px-5 py-2.5 text-xs text-vc-muted font-medium">Client</th>
              <th className="text-left px-5 py-2.5 text-xs text-vc-muted font-medium">Package</th>
              <th className="text-left px-5 py-2.5 text-xs text-vc-muted font-medium">Retainer</th>
              <th className="text-left px-5 py-2.5 text-xs text-vc-muted font-medium">Rev Share %</th>
              <th className="text-left px-5 py-2.5 text-xs text-vc-muted font-medium">Est. Commission</th>
              <th className="text-left px-5 py-2.5 text-xs text-vc-muted font-medium">Total MRR</th>
            </tr>
          </thead>
          <tbody>
            {clients.filter((c) => c.status !== 'churned').map((c) => {
              const commission = c.revenue_share_percentage > 0
                ? Math.round(c.ad_spend_managed * (c.revenue_share_percentage / 100))
                : 0
              const total = c.monthly_retainer + commission
              return (
                <tr key={c.id} className="border-b border-vc-border last:border-0 hover:bg-vc-secondary transition-colors">
                  <td className="px-5 py-3 font-medium text-vc-text">{c.company_name}</td>
                  <td className="px-5 py-3 text-vc-muted">{c.package_tier}</td>
                  <td className="px-5 py-3 text-vc-text">£{c.monthly_retainer.toLocaleString()}</td>
                  <td className="px-5 py-3 text-vc-muted">{c.revenue_share_percentage > 0 ? `${c.revenue_share_percentage}%` : '—'}</td>
                  <td className="px-5 py-3 text-vc-text">{commission > 0 ? `£${commission.toLocaleString()}` : '—'}</td>
                  <td className="px-5 py-3 font-semibold text-vc-text">£{total.toLocaleString()}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Invoice list */}
      <div className="border border-vc-border">
        <div className="px-5 py-3 border-b border-vc-border">
          <h2 className="text-sm font-medium text-vc-text">Invoice History</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-vc-border bg-vc-secondary">
              <th className="text-left px-5 py-2.5 text-xs text-vc-muted font-medium">Client</th>
              <th className="text-left px-5 py-2.5 text-xs text-vc-muted font-medium">Type</th>
              <th className="text-left px-5 py-2.5 text-xs text-vc-muted font-medium">Amount</th>
              <th className="text-left px-5 py-2.5 text-xs text-vc-muted font-medium">Due</th>
              <th className="text-left px-5 py-2.5 text-xs text-vc-muted font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv) => (
              <tr key={inv.id} className="border-b border-vc-border last:border-0 hover:bg-vc-secondary transition-colors">
                <td className="px-5 py-3 font-medium text-vc-text">{inv.client_name}</td>
                <td className="px-5 py-3 capitalize text-vc-muted">{inv.type}</td>
                <td className="px-5 py-3 text-vc-text">£{inv.amount.toLocaleString()}</td>
                <td className="px-5 py-3 text-vc-muted">{inv.due_date}</td>
                <td className="px-5 py-3">
                  <Badge variant={inv.status === 'paid' ? 'green' : inv.status === 'overdue' ? 'red' : inv.status === 'sent' ? 'blue' : 'default'}>
                    {inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}
                  </Badge>
                </td>
              </tr>
            ))}
            {invoices.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-6 text-center text-sm text-vc-muted">No invoices yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Add Invoice Modal ──────────────────────────────────────────────── */}
      <Modal
        isOpen={showInvoiceModal}
        onClose={() => setShowInvoiceModal(false)}
        title="Add Invoice"
        size="md"
      >
        <div className="space-y-4">
          <FormField label="Client" required error={invoiceErrors.client_id}>
            <select
              className={selectClass}
              value={invoiceForm.client_id}
              onChange={(e) => setInvoiceForm({ ...invoiceForm, client_id: e.target.value })}
            >
              <option value="">Select client…</option>
              {clients.filter((c) => c.status !== 'churned').map((c) => (
                <option key={c.id} value={c.id}>{c.company_name}</option>
              ))}
            </select>
          </FormField>

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

          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setShowInvoiceModal(false)} className="border border-vc-border text-vc-text text-sm px-4 py-2 rounded hover:bg-vc-secondary">
              Cancel
            </button>
            <button onClick={handleSaveInvoice} disabled={saving} className="bg-gold hover:bg-gold-dark text-white text-sm px-4 py-2 rounded disabled:opacity-60">
              {saving ? 'Saving…' : 'Create Invoice'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
