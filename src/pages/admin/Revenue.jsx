import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import Badge from '../../components/ui/Badge'
import StatCard from '../../components/ui/StatCard'
import { DEMO_CLIENTS, DEMO_INVOICES, DEMO_BUSINESS_METRICS } from '../../data/placeholder'

const MONTHLY_REV = [
  { month: 'Oct', retainer: 8500, commission: 620 },
  { month: 'Nov', retainer: 9500, commission: 740 },
  { month: 'Dec', retainer: 9500, commission: 680 },
  { month: 'Jan', retainer: 11000, commission: 890 },
  { month: 'Feb', retainer: 11500, commission: 960 },
  { month: 'Mar', retainer: 12500, commission: 1040 },
]

export default function Revenue() {
  const m = DEMO_BUSINESS_METRICS
  const totalRetainer = DEMO_CLIENTS.filter(c => c.status === 'active').reduce((s, c) => s + c.monthly_retainer, 0)
  const totalOutstanding = DEMO_INVOICES.filter(i => i.status === 'overdue').reduce((s, i) => s + i.amount, 0)

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-vc-text">Revenue</h1>
        <p className="text-sm text-vc-muted mt-0.5">Retainer + commission tracking</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Monthly Recurring Revenue" value={`£${m.mrr.toLocaleString()}`} trend={m.mrr_change} />
        <StatCard label="Retainer Revenue" value={`£${totalRetainer.toLocaleString()}`} sub="4 active clients" />
        <StatCard label="Outstanding Invoices" value={`£${totalOutstanding.toLocaleString()}`} sub="1 overdue" />
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
            {DEMO_CLIENTS.filter(c => c.status !== 'churned').map((c) => {
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
            {DEMO_INVOICES.map((inv) => (
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
          </tbody>
        </table>
      </div>
    </div>
  )
}
