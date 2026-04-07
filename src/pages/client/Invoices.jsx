import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { apiFetch } from '../../lib/api'

const STATUS_BADGE = { paid: 'green', sent: 'blue', overdue: 'red', draft: 'default', auto_charging: 'blue', payment_failed: 'red' }
const STATUS_LABEL = { paid: 'Paid', sent: 'Sent', overdue: 'Overdue', draft: 'Draft', auto_charging: 'Processing', payment_failed: 'Failed' }

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(amount || 0)
}

function InvoiceDetailModal({ invoice, onClose }) {
  if (!invoice) return null
  const charges = invoice.revenue_snapshot?.charges || []
  const isAutoBilling = invoice.type === 'auto_billing'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-bg-elevated border border-white/[0.08] w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-card p-6 shadow-elevated">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">Invoice {invoice.id.slice(0, 8).toUpperCase()}</h2>
            <p className="text-xs text-text-secondary mt-0.5">
              {invoice.period_start && invoice.period_end
                ? `Billing period: ${invoice.period_start} → ${invoice.period_end}`
                : `Created ${new Date(invoice.created_at).toLocaleDateString('en-GB')}`}
            </p>
          </div>
          <button onClick={onClose} className="text-text-secondary hover:text-text-primary">
            <X size={18} />
          </button>
        </div>

        {isAutoBilling && (
          <>
            <div className="bg-bg-tertiary border border-white/[0.06] rounded-card p-4 mb-4">
              <h3 className="text-sm font-semibold text-text-primary mb-3">Bill breakdown</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-text-secondary">
                  <span>Revenue tracked from Stripe</span>
                  <span className="text-text-primary">{formatCurrency(invoice.revenue_amount)}</span>
                </div>
                <div className="flex justify-between text-text-secondary">
                  <span>Your share ({invoice.revenue_snapshot?.percentage || 0}%)</span>
                  <span className="text-text-primary">×</span>
                </div>
                <div className="flex justify-between text-text-secondary">
                  <span>Commission this cycle</span>
                  <span className="text-text-primary">{formatCurrency(invoice.commission_amount)}</span>
                </div>
                <div className="flex justify-between text-text-secondary">
                  <span>Monthly retainer</span>
                  <span className="text-text-primary">{formatCurrency(invoice.retainer_amount)}</span>
                </div>
                <div className="flex justify-between text-base font-semibold text-text-primary border-t border-white/[0.06] pt-2 mt-2">
                  <span>Total</span>
                  <span>{formatCurrency(invoice.amount)}</span>
                </div>
              </div>
            </div>

            {charges.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-text-primary mb-2">
                  Stripe charges ({charges.length}) — net of refunds
                </h3>
                <div className="border border-white/[0.06] rounded">
                  <table className="w-full text-xs">
                    <thead className="bg-bg-tertiary">
                      <tr>
                        <th className="text-left px-3 py-2 text-text-secondary font-medium">Date</th>
                        <th className="text-left px-3 py-2 text-text-secondary font-medium">Description</th>
                        <th className="text-right px-3 py-2 text-text-secondary font-medium">Amount</th>
                        <th className="text-right px-3 py-2 text-text-secondary font-medium">Refunded</th>
                        <th className="text-right px-3 py-2 text-text-secondary font-medium">Net</th>
                      </tr>
                    </thead>
                    <tbody>
                      {charges.map((c) => (
                        <tr key={c.id} className="border-t border-white/[0.06]">
                          <td className="px-3 py-2 text-text-secondary">{c.date}</td>
                          <td className="px-3 py-2 text-text-primary truncate max-w-[200px]">{c.description || '—'}</td>
                          <td className="px-3 py-2 text-right text-text-primary">£{c.amount.toFixed(2)}</td>
                          <td className="px-3 py-2 text-right text-text-secondary">{c.refunded > 0 ? `£${c.refunded.toFixed(2)}` : '—'}</td>
                          <td className="px-3 py-2 text-right text-text-primary font-medium">£{c.net.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        {!isAutoBilling && (
          <div className="bg-bg-tertiary border border-white/[0.06] rounded-card p-4">
            <div className="flex justify-between text-sm">
              <span className="text-text-secondary capitalize">{invoice.type} invoice</span>
              <span className="text-text-primary font-semibold">{formatCurrency(invoice.amount)}</span>
            </div>
            <p className="text-xs text-text-secondary mt-2">
              Due {invoice.due_date} — Status: {STATUS_LABEL[invoice.status] || invoice.status}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export default function Invoices() {
  const { profile } = useAuth()
  const [invoices, setInvoices] = useState([])
  const [paying, setPaying] = useState(null)
  const [payError, setPayError] = useState('')
  const [selectedInvoice, setSelectedInvoice] = useState(null)

  useEffect(() => {
    if (!supabase || !profile?.client_id) return

    supabase
      .from('invoices')
      .select('id, client_id, amount, type, due_date, paid_date, status, created_at, period_start, period_end, revenue_amount, commission_amount, retainer_amount, revenue_snapshot')
      .eq('client_id', profile.client_id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (data) setInvoices(data)
      })
  }, [profile?.client_id])

  async function handlePay(inv) {
    setPayError('')
    setPaying(inv.id)
    try {
      const res = await apiFetch('/api/stripe/create-checkout', {
        method: 'POST',
        body: JSON.stringify({ invoice_id: inv.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Payment failed')
      window.location.href = data.url
    } catch (err) {
      setPayError(err.message)
      setPaying(null)
    }
  }

  const outstanding = invoices.filter((i) => i.status === 'sent' || i.status === 'overdue')
  const total = outstanding.reduce((s, i) => s + Number(i.amount), 0)

  return (
    <div className="p-4 md:p-6 space-y-5 w-full overflow-x-hidden">
      <div>
        <h1 className="text-h2 font-heading text-text-primary">Invoices</h1>
        <p className="text-sm text-text-secondary mt-0.5">Payment history and upcoming invoices</p>
      </div>

      {payError && (
        <div className="border border-status-danger/20 bg-status-danger/10 px-4 py-3 text-sm text-status-danger">
          {payError}
        </div>
      )}

      {outstanding.length > 0 && (
        <div className="border border-vc-primary bg-status-warning/10 p-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-text-primary">Outstanding balance</p>
            <p className="text-2xl font-semibold text-text-primary mt-0.5">£{total.toLocaleString()}</p>
          </div>
          <Button
            variant="gold"
            onClick={() => handlePay(outstanding[0])}
            disabled={!!paying}
          >
            {paying ? 'Redirecting...' : 'Pay now'}
          </Button>
        </div>
      )}

      <div className="border border-white/[0.06] overflow-x-auto">
        <table className="w-full text-sm min-w-[560px]">
          <thead>
            <tr className="border-b border-white/[0.06] bg-bg-tertiary">
              <th className="text-left px-5 py-2.5 text-xs text-text-secondary font-medium">Invoice</th>
              <th className="text-left px-5 py-2.5 text-xs text-text-secondary font-medium">Type</th>
              <th className="text-left px-5 py-2.5 text-xs text-text-secondary font-medium">Amount</th>
              <th className="text-left px-5 py-2.5 text-xs text-text-secondary font-medium">Due Date</th>
              <th className="text-left px-5 py-2.5 text-xs text-text-secondary font-medium">Paid</th>
              <th className="text-left px-5 py-2.5 text-xs text-text-secondary font-medium">Status</th>
              <th className="px-5 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {invoices.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-4 text-sm text-text-secondary">
                  No invoices yet.
                </td>
              </tr>
            )}
            {invoices.map((inv) => (
              <tr
                key={inv.id}
                onClick={() => setSelectedInvoice(inv)}
                className="border-b border-white/[0.06] last:border-0 hover:bg-bg-tertiary transition-colors cursor-pointer"
              >
                <td className="px-5 py-3 font-mono text-xs text-text-secondary">
                  {inv.id.slice(0, 8).toUpperCase()}
                </td>
                <td className="px-5 py-3 capitalize text-text-primary">{inv.type.replace('_', ' ')}</td>
                <td className="px-5 py-3 font-semibold text-text-primary">
                  £{Number(inv.amount).toLocaleString()}
                </td>
                <td className="px-5 py-3 text-text-secondary">{inv.due_date ?? '—'}</td>
                <td className="px-5 py-3 text-text-secondary">{inv.paid_date ?? '—'}</td>
                <td className="px-5 py-3">
                  <Badge variant={STATUS_BADGE[inv.status]}>
                    {STATUS_LABEL[inv.status] || inv.status}
                  </Badge>
                </td>
                <td className="px-5 py-3" onClick={(e) => e.stopPropagation()}>
                  {(inv.status === 'sent' || inv.status === 'overdue') && (
                    <Button
                      variant="gold"
                      size="sm"
                      onClick={() => handlePay(inv)}
                      disabled={paying === inv.id}
                    >
                      {paying === inv.id ? '...' : 'Pay'}
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <InvoiceDetailModal invoice={selectedInvoice} onClose={() => setSelectedInvoice(null)} />
    </div>
  )
}
