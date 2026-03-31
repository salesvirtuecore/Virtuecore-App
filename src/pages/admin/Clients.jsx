import { useCallback, useEffect, useState } from 'react'
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
const PORTAL_BADGE = { joined: 'green', invited: 'blue' }

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

function withPortalStatus(clientRows, profileRows = []) {
  const joinedByClientId = new Map()

  for (const profile of profileRows) {
    if (!profile?.client_id) continue
    const existing = joinedByClientId.get(profile.client_id)
    if (!existing || new Date(profile.created_at) < new Date(existing.created_at)) {
      joinedByClientId.set(profile.client_id, profile)
    }
  }

  return clientRows.map((client) => {
    const linkedProfile = joinedByClientId.get(client.id)
    return {
      ...client,
      portal_joined: Boolean(linkedProfile),
      portal_joined_at: linkedProfile?.created_at || null,
    }
  })
}

export default function Clients() {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [showInvite, setShowInvite] = useState(false)
  const [clients, setClients] = useState(isDemoMode ? DEMO_CLIENTS : [])
  const [loadingClients, setLoadingClients] = useState(!isDemoMode)
  const [editClient, setEditClient] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const navigate = useNavigate()
  const { showToast } = useToast()

  const loadClients = useCallback(async () => {
    if (isDemoMode || !supabase) return

    setLoadingClients(true)
    try {
      const [{ data: clientRows, error: clientError }, { data: profileRows, error: profileError }] = await Promise.all([
        supabase.from('clients').select('*').order('created_at', { ascending: false }),
        supabase.from('profiles').select('client_id, created_at').not('client_id', 'is', null),
      ])

      if (clientError) throw clientError
      if (profileError) throw profileError
      setClients(withPortalStatus(clientRows || [], profileRows || []))
    } catch (err) {
      setClients([])
      showToast(err.message ?? 'Failed to load clients', 'error')
    } finally {
      setLoadingClients(false)
    }
  }, [showToast])

  useEffect(() => { loadClients() }, [loadClients])

  useEffect(() => {
    if (isDemoMode || !supabase) return undefined

    const channel = supabase
      .channel('admin-clients-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clients' }, () => loadClients())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, (payload) => {
        if (payload?.new?.client_id || payload?.old?.client_id) loadClients()
      })
      .subscribe()

    const pollId = window.setInterval(() => loadClients(), 15000)
    const refreshOnFocus = () => loadClients()
    const refreshOnVisible = () => { if (document.visibilityState === 'visible') loadClients() }

    window.addEventListener('focus', refreshOnFocus)
    document.addEventListener('visibilitychange', refreshOnVisible)

    return () => {
      window.clearInterval(pollId)
      window.removeEventListener('focus', refreshOnFocus)
      document.removeEventListener('visibilitychange', refreshOnVisible)
      supabase.removeChannel(channel)
    }
  }, [loadClients])

  const filtered = clients.filter((c) => {
    const matchSearch =
      (c.company_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (c.contact_name || '').toLowerCase().includes(search.toLowerCase())
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
        setClients((prev) => prev.map((c) => (c.id === editClient.id ? { ...c, ...updates } : c)))
      } else {
        const { error } = await supabase.from('clients').update(updates).eq('id', editClient.id)
        if (error) throw error
        setClients((prev) => prev.map((c) => (c.id === editClient.id ? { ...c, ...updates } : c)))
      }

      showToast(`${updates.company_name} updated successfully`)
      closeEdit()
    } catch (err) {
      showToast(err.message ?? 'Failed to save client', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleStripeConnect(client) {
    if (isDemoMode) {
      showToast('Stripe connect not available in demo mode', 'info')
      return
    }

    try {
      setSaving(true)
      const response = await fetch('/api/stripe/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: client.id, contact_email: client.contact_email }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Stripe connect failed')

      if (data.stripeAccountId) {
        setClients((prev) =>
          prev.map((c) => (c.id === client.id ? { ...c, stripe_account_id: data.stripeAccountId } : c))
        )
      }

      if (data.connectUrl) {
        window.open(data.connectUrl, '_blank', 'noreferrer')
        showToast('Stripe onboarding window opened', 'success')
      } else {
        showToast('Stripe account created, return to client list to confirm', 'success')
      }
    } catch (err) {
      showToast(err.message || 'Stripe connection failed', 'error')
    } finally {
      setSaving(false)
    }
  }

  const inputClass = 'bg-bg-tertiary border border-white/[0.08] rounded-btn px-3 py-2 w-full text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-vc-primary focus:ring-1 focus:ring-vc-primary'
  const selectClass = inputClass

  return (
    <div className="p-6 space-y-5 max-w-[1440px] mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-h2 font-heading text-text-primary">Clients</h1>
          <p className="text-sm text-text-secondary mt-0.5">
            {clients.filter((c) => c.status === 'active').length} active clients
          </p>
        </div>
        <button
          onClick={() => setShowInvite(true)}
          className="bg-vc-primary hover:bg-vc-accent text-white text-sm px-4 py-2 rounded-btn flex items-center gap-2 transition-colors"
        >
          <UserPlus size={14} />
          Invite Client
        </button>
      </div>

      <InviteModal isOpen={showInvite} onClose={() => setShowInvite(false)} role="client" onSuccess={loadClients} />

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search clients..."
            className="w-full pl-9 pr-3 py-2 text-sm bg-bg-tertiary border border-white/[0.08] rounded-btn text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-vc-primary focus:ring-1 focus:ring-vc-primary"
          />
        </div>
        {['all', 'active', 'onboarding', 'churned'].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 text-xs font-medium transition-colors capitalize rounded-btn ${
              filter === s
                ? 'bg-vc-primary text-white'
                : 'bg-bg-tertiary border border-white/[0.08] text-text-secondary hover:text-text-primary hover:border-white/[0.16]'
            }`}
          >
            {s === 'all' ? 'All' : STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="vc-card p-0 overflow-hidden">
        <table className="vc-table">
          <thead>
            <tr>
              <th>Company</th>
              <th>Package</th>
              <th>MRR</th>
              <th>Ad Spend</th>
              <th>Stripe</th>
              <th>Status</th>
              <th>Portal</th>
              <th>Health</th>
              <th>Payment</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {loadingClients && filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="px-5 py-8 text-center text-sm text-text-secondary">
                  Loading clients...
                </td>
              </tr>
            )}
            {filtered.map((c) => (
              <tr key={c.id}>
                <td>
                  <p className="font-medium text-text-primary">{c.company_name}</p>
                  <p className="text-xs text-text-tertiary">{c.contact_email}</p>
                </td>
                <td className="text-text-secondary">{c.package_tier}</td>
                <td className="mono">£{Number(c.monthly_retainer || 0).toLocaleString()}</td>
                <td className="mono">
                  {Number(c.ad_spend_managed || 0) > 0 ? `£${Number(c.ad_spend_managed).toLocaleString()}` : '—'}
                </td>
                <td>
                  {c.stripe_account_id ? (
                    <Badge variant="green" dot>Connected</Badge>
                  ) : (
                    <button
                      onClick={() => handleStripeConnect(c)}
                      className="text-text-tertiary hover:text-text-primary text-xs transition-colors"
                      disabled={saving}
                    >
                      Connect Stripe
                    </button>
                  )}
                </td>
                <td><Badge variant={STATUS_BADGE[c.status]}>{STATUS_LABELS[c.status]}</Badge></td>
                <td>
                  <Badge variant={PORTAL_BADGE[c.portal_joined ? 'joined' : 'invited']} dot>
                    {c.portal_joined ? 'Joined' : 'Invited'}
                  </Badge>
                </td>
                <td>
                  <Badge variant={HEALTH_BADGE[c.health_score] ?? 'default'} dot>
                    {c.health_score ? c.health_score.charAt(0).toUpperCase() + c.health_score.slice(1) : '—'}
                  </Badge>
                </td>
                <td>
                  <Badge variant={c.payment_status === 'paid' ? 'green' : c.payment_status === 'overdue' ? 'red' : c.payment_status ? 'amber' : 'default'} dot>
                    {c.payment_status ? c.payment_status.charAt(0).toUpperCase() + c.payment_status.slice(1) : '—'}
                  </Badge>
                </td>
                <td>
                  <div className="flex items-center gap-2">
                    <button onClick={() => openEdit(c)} className="text-text-tertiary hover:text-text-primary transition-colors" title="Edit client">
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => navigate(`/admin/clients/${c.id}`)} className="text-text-tertiary hover:text-text-primary transition-colors" title="View client">
                      <ExternalLink size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!loadingClients && filtered.length === 0 && (
              <tr>
                <td colSpan={10} className="px-5 py-8 text-center text-sm text-text-secondary">
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
              <input className={inputClass} value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} />
            </FormField>

            <FormField label="Contact Name" required error={errors.contact_name}>
              <input className={inputClass} value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} />
            </FormField>

            <FormField label="Contact Email" required error={errors.contact_email}>
              <input type="email" className={inputClass} value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} />
            </FormField>

            <div className="grid grid-cols-2 gap-3">
              <FormField label="Package Tier" required>
                <select className={selectClass} value={form.package_tier} onChange={(e) => setForm({ ...form, package_tier: e.target.value })}>
                  <option>Starter</option>
                  <option>Growth</option>
                  <option>Premium</option>
                </select>
              </FormField>

              <FormField label="Status" required>
                <select className={selectClass} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  <option value="active">Active</option>
                  <option value="onboarding">Onboarding</option>
                  <option value="churned">Churned</option>
                </select>
              </FormField>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <FormField label="Monthly Retainer (£)" required error={errors.monthly_retainer}>
                <input type="number" className={inputClass} value={form.monthly_retainer} onChange={(e) => setForm({ ...form, monthly_retainer: e.target.value })} min="0" />
              </FormField>

              <FormField label="Revenue Share %" required error={errors.revenue_share_percentage}>
                <input type="number" className={inputClass} value={form.revenue_share_percentage} onChange={(e) => setForm({ ...form, revenue_share_percentage: e.target.value })} min="0" max="100" step="0.1" />
              </FormField>
            </div>

            <FormField label="Health Score" required>
              <select className={selectClass} value={form.health_score} onChange={(e) => setForm({ ...form, health_score: e.target.value })}>
                <option value="green">Green</option>
                <option value="amber">Amber</option>
                <option value="red">Red</option>
              </select>
            </FormField>

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={closeEdit} className="border border-white/[0.08] text-text-secondary text-sm px-4 py-2 rounded-btn hover:bg-bg-tertiary transition-colors">
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving} className="bg-vc-primary hover:bg-vc-accent text-white text-sm px-4 py-2 rounded-btn disabled:opacity-60 transition-colors">
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
