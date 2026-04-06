import { useState, useEffect } from 'react'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { apiFetch } from '../../lib/api'

const STATUS_BADGE = { paid: 'green', sent: 'blue', overdue: 'red', draft: 'default' }

export default function Invoices() {
  const { profile } = useAuth()
  const [invoices, setInvoices] = useState([])
  const [paying, setPaying] = useState(null)
  const [payError, setPayError] = useState('')

  useEffect(() => {
    if (!supabase || !profile?.client_id) return

    supabase
      .from('invoices')
      .select('id, client_id, amount, type, due_date, paid_date, status, created_at')
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
              <tr key={inv.id} className="border-b border-white/[0.06] last:border-0 hover:bg-bg-tertiary transition-colors">
                <td className="px-5 py-3 font-mono text-xs text-text-secondary">
                  {inv.id.slice(0, 8).toUpperCase()}
                </td>
                <td className="px-5 py-3 capitalize text-text-primary">{inv.type}</td>
                <td className="px-5 py-3 font-semibold text-text-primary">
                  £{Number(inv.amount).toLocaleString()}
                </td>
                <td className="px-5 py-3 text-text-secondary">{inv.due_date ?? '—'}</td>
                <td className="px-5 py-3 text-text-secondary">{inv.paid_date ?? '—'}</td>
                <td className="px-5 py-3">
                  <Badge variant={STATUS_BADGE[inv.status]}>
                    {inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}
                  </Badge>
                </td>
                <td className="px-5 py-3">
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
                  {inv.status === 'paid' && (
                    <button className="text-xs text-text-secondary hover:text-text-primary transition-colors">
                      Download
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
