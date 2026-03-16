import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import { DEMO_INVOICES } from '../../data/placeholder'

const CLIENT_INVOICES = DEMO_INVOICES.filter((i) => i.client_id === 'c-001')

const STATUS_BADGE = { paid: 'green', sent: 'blue', overdue: 'red', draft: 'default' }

export default function Invoices() {
  const outstanding = CLIENT_INVOICES.filter((i) => i.status === 'sent' || i.status === 'overdue')
  const total = outstanding.reduce((s, i) => s + i.amount, 0)

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-vc-text">Invoices</h1>
        <p className="text-sm text-vc-muted mt-0.5">Payment history and upcoming invoices</p>
      </div>

      {outstanding.length > 0 && (
        <div className="border border-gold bg-amber-50 p-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-vc-text">Outstanding balance</p>
            <p className="text-2xl font-semibold text-vc-text mt-0.5">£{total.toLocaleString()}</p>
          </div>
          <Button variant="gold">Pay now</Button>
        </div>
      )}

      <div className="border border-vc-border">
        <table className="w-full text-sm">
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
            {CLIENT_INVOICES.map((inv) => (
              <tr key={inv.id} className="border-b border-vc-border last:border-0 hover:bg-vc-secondary transition-colors">
                <td className="px-5 py-3 font-mono text-xs text-vc-muted">{inv.id.toUpperCase()}</td>
                <td className="px-5 py-3 capitalize text-vc-text">{inv.type}</td>
                <td className="px-5 py-3 font-semibold text-vc-text">£{inv.amount.toLocaleString()}</td>
                <td className="px-5 py-3 text-vc-muted">{inv.due_date}</td>
                <td className="px-5 py-3 text-vc-muted">{inv.paid_date ?? '—'}</td>
                <td className="px-5 py-3">
                  <Badge variant={STATUS_BADGE[inv.status]}>
                    {inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}
                  </Badge>
                </td>
                <td className="px-5 py-3">
                  {(inv.status === 'sent' || inv.status === 'overdue') && (
                    <Button variant="gold" size="sm">Pay</Button>
                  )}
                  {inv.status === 'paid' && (
                    <button className="text-xs text-vc-muted hover:text-vc-text transition-colors">Download</button>
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
