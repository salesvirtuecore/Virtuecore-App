import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, ExternalLink, UserPlus } from 'lucide-react'
import Badge from '../../components/ui/Badge'
import InviteModal from '../../components/ui/InviteModal'
import { DEMO_CLIENTS } from '../../data/placeholder'

const STATUS_LABELS = { active: 'Active', onboarding: 'Onboarding', churned: 'Churned' }
const STATUS_BADGE = { active: 'green', onboarding: 'blue', churned: 'default' }
const HEALTH_BADGE = { green: 'green', amber: 'amber', red: 'red' }

export default function Clients() {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [showInvite, setShowInvite] = useState(false)
  const navigate = useNavigate()

  const filtered = DEMO_CLIENTS.filter((c) => {
    const matchSearch = c.company_name.toLowerCase().includes(search.toLowerCase()) ||
      c.contact_name.toLowerCase().includes(search.toLowerCase())
    const matchFilter = filter === 'all' || c.status === filter
    return matchSearch && matchFilter
  })

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-vc-text">Clients</h1>
          <p className="text-sm text-vc-muted mt-0.5">{DEMO_CLIENTS.filter(c => c.status === 'active').length} active clients</p>
        </div>
        <button
          onClick={() => setShowInvite(true)}
          className="bg-gold hover:bg-gold-dark text-white text-sm px-4 py-2 rounded flex items-center gap-2"
        >
          <UserPlus size={14} />
          Invite Client
        </button>
      </div>

      <InviteModal isOpen={showInvite} onClose={() => setShowInvite(false)} role="client" />

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-vc-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search clients..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-vc-border focus:outline-none focus:border-vc-text"
          />
        </div>
        {['all', 'active', 'onboarding', 'churned'].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 text-xs font-medium transition-colors capitalize ${
              filter === s
                ? 'bg-vc-text text-white'
                : 'bg-white border border-vc-border text-vc-muted hover:text-vc-text'
            }`}
          >
            {s === 'all' ? 'All' : STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="border border-vc-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-vc-border bg-vc-secondary">
              <th className="text-left px-5 py-2.5 text-xs text-vc-muted font-medium">Company</th>
              <th className="text-left px-5 py-2.5 text-xs text-vc-muted font-medium">Package</th>
              <th className="text-left px-5 py-2.5 text-xs text-vc-muted font-medium">MRR</th>
              <th className="text-left px-5 py-2.5 text-xs text-vc-muted font-medium">Ad Spend</th>
              <th className="text-left px-5 py-2.5 text-xs text-vc-muted font-medium">Status</th>
              <th className="text-left px-5 py-2.5 text-xs text-vc-muted font-medium">Health</th>
              <th className="text-left px-5 py-2.5 text-xs text-vc-muted font-medium">Payment</th>
              <th className="px-5 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.id} className="border-b border-vc-border last:border-0 hover:bg-vc-secondary transition-colors">
                <td className="px-5 py-3">
                  <p className="font-medium text-vc-text">{c.company_name}</p>
                  <p className="text-xs text-vc-muted">{c.contact_email}</p>
                </td>
                <td className="px-5 py-3 text-vc-muted">{c.package_tier}</td>
                <td className="px-5 py-3 text-vc-text font-medium">£{c.monthly_retainer.toLocaleString()}</td>
                <td className="px-5 py-3 text-vc-text">
                  {c.ad_spend_managed > 0 ? `£${c.ad_spend_managed.toLocaleString()}` : '—'}
                </td>
                <td className="px-5 py-3">
                  <Badge variant={STATUS_BADGE[c.status]}>{STATUS_LABELS[c.status]}</Badge>
                </td>
                <td className="px-5 py-3">
                  <Badge variant={HEALTH_BADGE[c.health_score]}>
                    {c.health_score.charAt(0).toUpperCase() + c.health_score.slice(1)}
                  </Badge>
                </td>
                <td className="px-5 py-3">
                  <Badge variant={c.payment_status === 'paid' ? 'green' : c.payment_status === 'overdue' ? 'red' : 'amber'}>
                    {c.payment_status.charAt(0).toUpperCase() + c.payment_status.slice(1)}
                  </Badge>
                </td>
                <td className="px-5 py-3">
                  <button
                    onClick={() => navigate(`/admin/clients/${c.id}`)}
                    className="text-vc-muted hover:text-vc-text transition-colors"
                  >
                    <ExternalLink size={14} />
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-5 py-8 text-center text-sm text-vc-muted">
                  No clients match your search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
