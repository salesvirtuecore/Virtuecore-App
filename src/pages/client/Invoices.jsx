import { useState, useEffect } from 'react'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import { supabase, isDemoMode } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { DEMO_INVOICES } from '../../data/placeholder'

const STATUS_BADGE = { paid: 'green', sent: 'blue', overdue: 'red', draft: 'default' }

export default function Invoices() {
  const { profile } = useAuth()
  const [invoices, setInvoices] = useState(
    isDemoMode ? DEMO_INVOICES.filter((i) => i.client_id === 'c-001') : []
  )
  const [paying, setPaying] = useState(null)
  const [payError, setPayError] = useState('')

  useEffect(() => {
    if (isDemoMode || !supabase || !profile?.client_id) return

    supabase
      .from('invoices')
      .select('*')
      .eq('client_id', profile.client_id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (data) setInvoices(data)
      })
  }, [profile?.client_id])

  async function handlePay(inv) {
    if (isDemoMode) {
      alert('Payment is disabled in demo mode.')
      return
    }
    setPayError('')
    setPaying(inv.id)
    try {
      const res = await fetch('/api/stripe/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
        <h1 className="text-xl font-semibold text-vc-text">Invoices</h1>
        <p className="text-sm text-vc-muted mt-0.5">Payment history and upcoming invoices</p>
      </div>

      {payError && (
        <div className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {payError}
        </div>
      )}

      {outstanding.length > 0 && (
        <div className="border border-gold bg-amber-50 p-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-vc-text">Outstanding balance</p>
            <p className="text-2xl font-semibold text-vc-text mt-0.5">£{total.toLocaleString()}</p>
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

      <div className="border border-vc-border overflow-x-auto">
        <table className="w-full text-sm min-w-[560px]">
          <thead>
            <tr className="border-b border-vc-border bg-vc-secondary">
              <th className="text-left px-5 py-2.5 text-xs text-vc-muted font-medium">Invoice</th>
              <th className="text-left px-5 py-2.5 text-xs text-vc-muted font-medium">Type</th>
              <th className="text-left px-5 py-2.5 text-xs text-vc-muted font-medium">Amount</th>
              <th className="text-left px-5 py-2.5 text-xs text-vc-muted font-medium">Due Date</th>
              <th className="text-left px-5 py-2.5 text-xs text-vc-muted font-medium">Paid</th>
              <th className="text-left px-5 py-2.5 text-xs text-vc-muted font-medium">Status</th>
              <th className="px-5 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {invoices.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-4 text-sm text-vc-muted">
                  No invoices yet.
                </td>
              </tr>
            )}
            {invoices.map((inv) => (
              <tr key={inv.id} className="border-b border-vc-border last:border-0 hover:bg-vc-secondary transition-colors">
                <td className="px-5 py-3 font-mono text-xs text-vc-muted">
                  {inv.id.slice(0, 8).toUpperCase()}
                </td>
                <td className="px-5 py-3 capitalize text-vc-text">{inv.type}</td>
                <td className="px-5 py-3 font-semibold text-vc-text">
                  £{Number(inv.amount).toLocaleString()}
                </td>
                <td className="px-5 py-3 text-vc-muted">{inv.due_date ?? '—'}</td>
                <td className="px-5 py-3 text-vc-muted">{inv.paid_date ?? '—'}</td>
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
                    <button className="text-xs text-vc-muted hover:text-vc-text transition-colors">
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
