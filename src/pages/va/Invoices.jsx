import { useEffect, useState } from 'react'
import Badge from '../../components/ui/Badge'
import { useToast } from '../../context/ToastContext'
import { apiFetch } from '../../lib/api'

const STATUS_BADGE = { pending: 'amber', approved: 'blue', paid: 'green', rejected: 'red' }
const STATUS_LABEL = { pending: 'Pending', approved: 'Approved', paid: 'Paid', rejected: 'Rejected' }

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(amount || 0)
}

export default function Invoices() {
  const { showToast } = useToast()
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(true)
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function loadInvoices() {
    setLoading(true)
    try {
      const res = await apiFetch('/api/va/my-invoices')
      const data = await res.json()
      if (res.ok) setInvoices(data.invoices || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadInvoices()
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    const parsedAmount = Number(amount)
    if (!parsedAmount || parsedAmount <= 0) return showToast('Enter a valid amount', 'error')
    setSubmitting(true)
    try {
      const res = await apiFetch('/api/va/submit', {
        method: 'POST',
        body: JSON.stringify({ amount: parsedAmount, note: note.trim() || null }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Submit failed')
      showToast('Invoice submitted')
      setAmount('')
      setNote('')
      loadInvoices()
    } catch (err) {
      showToast(err.message || 'Submit failed', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="p-4 md:p-6 space-y-5 w-full overflow-x-hidden">
      <div>
        <h1 className="text-h2 font-heading text-text-primary">Invoices</h1>
        <p className="text-sm text-text-secondary mt-0.5">Let us know what you're owed — we'll review and pay you outside the app.</p>
      </div>

      <div className="vc-card">
        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
          <div className="flex-1 w-full">
            <label className="text-xs text-text-secondary mb-1 block">Amount owed (GBP)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full text-sm bg-bg-tertiary border border-white/[0.08] rounded px-3 py-2 text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-vc-primary"
            />
          </div>
          <div className="flex-[2] w-full">
            <label className="text-xs text-text-secondary mb-1 block">Note (optional)</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. hours worked, what for"
              className="w-full text-sm bg-bg-tertiary border border-white/[0.08] rounded px-3 py-2 text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-vc-primary"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="text-xs px-4 py-2 bg-vc-primary text-white hover:bg-vc-accent rounded transition-colors disabled:opacity-60 flex-shrink-0"
          >
            {submitting ? 'Submitting...' : 'Submit'}
          </button>
        </form>
      </div>

      <div className="vc-card">
        <h2 className="text-sm font-semibold text-text-primary mb-3">Your submissions</h2>
        {loading ? (
          <p className="text-sm text-text-secondary">Loading...</p>
        ) : invoices.length === 0 ? (
          <p className="text-sm text-text-secondary">No invoices submitted yet.</p>
        ) : (
          <div className="space-y-2">
            {invoices.map((inv) => (
              <div key={inv.id} className="flex items-center gap-3 px-3 py-2 bg-bg-tertiary rounded">
                <span className="text-sm font-medium text-text-primary flex-shrink-0">{formatCurrency(inv.amount)}</span>
                <span className="text-xs text-text-secondary flex-1 truncate">{inv.note || '—'}</span>
                <Badge variant={STATUS_BADGE[inv.status]} size="xs">{STATUS_LABEL[inv.status]}</Badge>
                <span className="text-xs text-text-secondary flex-shrink-0">{formatDate(inv.created_at)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
