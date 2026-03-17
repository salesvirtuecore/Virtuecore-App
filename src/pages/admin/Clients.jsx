import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, ExternalLink, UserPlus, Pencil } from 'lucide-react'
import Badge from '../../components/ui/Badge'
import InviteModal from '../../components/ui/InviteModal'
import Modal from '../../components/ui/Modal'
import FormField from '../../components/ui/FormField'
import { DEMO_CLIENTS } from '../../data/placeholder'
import { isDemoMode, supabase } from '../../lib/supabase'
import { useToast } from '../../context/ToastContext'

const STATUS_LABELS = { active: 'Active', onboarding: 'Onboarding', churned: 'Churned' }
const STATUS_BADGE = { active: 'green', onboarding: 'blue', churned: 'default' }
const HEALTH_BADGE = { green: 'green', amber: 'amber', red: 'red' }

const EMPTY_FORM = {
  company_name: '',
  contact_name: '',
  contact_email: '',
  package_tier: 'Starter',
  monthly_retainer: '',
  revenue_share_percentage: '',
  status: 'active',
  health_score: 'green',
}

export default function Clients() {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [showInvite, setShowInvite] = useState(false)
  const [clients, setClients] = useState(DEMO_CLIENTS)
  const [editClient, setEditClient] = useState(null) // the client being edited
  const [form, setForm] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const navigate = useNavigate()
  const { showToast } = useToast()

  const filtered = clients.filter((c) => {
    const matchSearch =
      c.company_name.toLowerCase().includes(search.toLowerCase()) ||
      c.contact_name.toLowerCase().includes(search.toLowerCase())
    const matchFilter = filter === 'all' || c.status === filter
    return matchSearch && matchFilter
  })

  function openEdit(client) {
    setEditClient(client)
    setForm({
      company_name: client.company_name,
      contact_name: client.contact_name,
      contact_email: client.contact_email,
      package_tier: client.package_tier,
      monthly_retainer: client.monthly_retainer,
      revenue_share_percentage: client.revenue_share_percentage,
      status: client.status,
      health_score: client.health_score,
    })
    setErrors({})
  }

  function closeEdit() {
    setEditClient(null)
    setForm(EMPTY_FORM)
    setErrors({})
  }

  function validate() {
    const e = {}
    if (!form.company_name.trim()) e.company_name = 'Company name is required'
    if (!form.contact_name.trim()) e.contact_name = 'Contact name is required'
    if (!form.contact_email.trim()) e.contact_email = 'Email is required'
    if (form.monthly_retainer === '' || isNaN(Number(form.monthly_retainer))) e.monthly_retainer = 'Valid retainer amount required'
    if (form.revenue_share_percentage === '' || isNaN(Number(form.revenue_share_percentage))) e.revenue_share_percentage = 'Valid percentage required'
    return e
  }

  async function handleSave() {
    const e = validate()
    if (Object.keys(e).length) { setErrors(e); return }
    setSaving(true)
    try {
      const updates = {
        company_name: form.company_name.trim(),
        contact_name: form.contact_name.trim(),
        contact_email: form.contact_email.trim(),
        package_tier: form.package_tier,
        monthly_retainer: Number(form.monthly_retainer),
        revenue_share_percentage: Number(form.revenue_share_percentage),
        status: form.status,
        health_score: form.health_score,
      }

      if (isDemoMode) {
        setClients((prev) =>
          prev.map((c) => (c.id === editClient.id ? { ...c, ...updates } : c))
        )
      } else {
        const { error } = await supabase
          .from('clients')
          .update(updates)
          .eq('id', editClient.id)
        if (error) throw error
        setClients((prev) =>
          prev.map((c) => (c.id === editClient.id ? { ...c, ...updates } : c))
        )
      }

      showToast(`${updates.company_name} updated successfully`)
      closeEdit()
    } catch (err) {
      showToast(err.message ?? 'Failed to save client', 'error')
    } finally {
      setSaving(false)
    }
  }

  const inputClass = 'border border-vc-border rounded px-3 py-2 w-full text-sm text-vc-text focus:outline-none focus:border-gold'
  const selectClass = inputClass

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-vc-text">Clients</h1>
          <p className="text-sm text-vc-muted mt-0.5">
            {clients.filter((c) => c.status === 'active').length} active clients
          </p>
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
                  <Badge
                    variant={
                      c.payment_status === 'paid'
                        ? 'green'
                        : c.payment_status === 'overdue'
                        ? 'red'
                        : 'amber'
                    }
                  >
                    {c.payment_status.charAt(0).toUpperCase() + c.payment_status.slice(1)}
                  </Badge>
                </td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openEdit(c)}
                      className="text-vc-muted hover:text-vc-text transition-colors"
                      title="Edit client"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => navigate(`/admin/clients/${c.id}`)}
                      className="text-vc-muted hover:text-vc-text transition-colors"
                      title="View client"
                    >
                      <ExternalLink size={14} />
                    </button>
                  </div>
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

      {/* Edit Client Modal */}
      <Modal isOpen={!!editClient} onClose={closeEdit} title="Edit Client" size="md">
        {editClient && (
          <div className="space-y-4">
            <FormField label="Company Name" required error={errors.company_name}>
              <input
                className={inputClass}
                value={form.company_name}
                onChange={(e) => setForm({ ...form, company_name: e.target.value })}
              />
            </FormField>

            <FormField label="Contact Name" required error={errors.contact_name}>
              <input
                className={inputClass}
                value={form.contact_name}
                onChange={(e) => setForm({ ...form, contact_name: e.target.value })}
              />
            </FormField>

            <FormField label="Contact Email" required error={errors.contact_email}>
              <input
                type="email"
                className={inputClass}
                value={form.contact_email}
                onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
              />
            </FormField>

            <div className="grid grid-cols-2 gap-3">
              <FormField label="Package Tier" required>
                <select
                  className={selectClass}
                  value={form.package_tier}
                  onChange={(e) => setForm({ ...form, package_tier: e.target.value })}
                >
                  <option>Starter</option>
                  <option>Growth</option>
                  <option>Premium</option>
                </select>
              </FormField>

              <FormField label="Status" required>
                <select
                  className={selectClass}
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                >
                  <option value="active">Active</option>
                  <option value="onboarding">Onboarding</option>
                  <option value="churned">Churned</option>
                </select>
              </FormField>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <FormField label="Monthly Retainer (£)" required error={errors.monthly_retainer}>
                <input
                  type="number"
                  className={inputClass}
                  value={form.monthly_retainer}
                  onChange={(e) => setForm({ ...form, monthly_retainer: e.target.value })}
                  min="0"
                />
              </FormField>

              <FormField label="Revenue Share %" required error={errors.revenue_share_percentage}>
                <input
                  type="number"
                  className={inputClass}
                  value={form.revenue_share_percentage}
                  onChange={(e) => setForm({ ...form, revenue_share_percentage: e.target.value })}
                  min="0"
                  max="100"
                  step="0.1"
                />
              </FormField>
            </div>

            <FormField label="Health Score" required>
              <select
                className={selectClass}
                value={form.health_score}
                onChange={(e) => setForm({ ...form, health_score: e.target.value })}
              >
                <option value="green">Green</option>
                <option value="amber">Amber</option>
                <option value="red">Red</option>
              </select>
            </FormField>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={closeEdit}
                className="border border-vc-border text-vc-text text-sm px-4 py-2 rounded hover:bg-vc-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="bg-gold hover:bg-gold-dark text-white text-sm px-4 py-2 rounded disabled:opacity-60"
              >
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
