import { useEffect, useState } from 'react'
import { ExternalLink, Search } from 'lucide-react'
import Badge from '../../components/ui/Badge'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'

const STATUS_OPTIONS = ['New', 'Called', 'Churned', 'Later', 'Paid']

const STATUS_BADGE = {
  New: 'blue',
  Called: 'default',
  Churned: 'red',
  Later: 'amber',
  Paid: 'green',
}

export default function Leads({ clientId } = {}) {
  const { profile } = useAuth()
  const { showToast } = useToast()
  const effectiveClientId = clientId ?? profile?.client_id
  const isAdmin = profile?.role === 'admin'
  // Admin visiting the top-level /admin/client-leads route (no specific
  // client in context) sees every client's leads at once — same data,
  // same edit rights, just not scoped to one company.
  const showAllClients = isAdmin && !effectiveClientId

  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [crmSheetUrl, setCrmSheetUrl] = useState(null)
  const [savingId, setSavingId] = useState(null)

  useEffect(() => {
    if (!supabase || (!effectiveClientId && !showAllClients)) {
      setLoading(false)
      return
    }

    let canceled = false

    async function loadLeads() {
      setLoading(true)
      let query = supabase
        .from('client_leads')
        .select(
          showAllClients
            ? 'id, client_id, name, email, phone, source, package_interest, payment_method, amount, payment_date, total_paid, status, notes, created_at, clients(company_name, crm_sheet_id)'
            : 'id, client_id, name, email, phone, source, package_interest, payment_method, amount, payment_date, total_paid, status, notes, created_at'
        )
        .order('created_at', { ascending: false })
      if (!showAllClients) query = query.eq('client_id', effectiveClientId)

      const { data, error } = await query

      if (!canceled) {
        if (!error) setLeads(data || [])
        setLoading(false)
      }
    }

    async function loadCrmSheet() {
      if (showAllClients) return
      const { data } = await supabase
        .from('clients')
        .select('crm_sheet_id')
        .eq('id', effectiveClientId)
        .maybeSingle()
      if (!canceled && data?.crm_sheet_id) {
        setCrmSheetUrl(`https://docs.google.com/spreadsheets/d/${data.crm_sheet_id}`)
      }
    }

    loadLeads()
    loadCrmSheet()

    const channel = supabase
      .channel(showAllClients ? 'admin-all-client-leads' : `client-leads-${effectiveClientId}`)
      .on(
        'postgres_changes',
        showAllClients
          ? { event: '*', schema: 'public', table: 'client_leads' }
          : { event: '*', schema: 'public', table: 'client_leads', filter: `client_id=eq.${effectiveClientId}` },
        () => loadLeads()
      )
      .subscribe()

    return () => {
      canceled = true
      supabase.removeChannel(channel)
    }
  }, [effectiveClientId, showAllClients])

  async function updateLead(id, updates) {
    setSavingId(id)
    const { error } = await supabase
      .from('client_leads')
      .update({ ...updates, synced_from: 'app' })
      .eq('id', id)
    setSavingId(null)
    if (error) {
      showToast(error.message ?? 'Failed to update lead', 'error')
      return
    }
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, ...updates } : l)))
  }

  const filtered = leads.filter((l) => {
    const q = search.toLowerCase()
    return (
      (l.name || '').toLowerCase().includes(q) ||
      (l.email || '').toLowerCase().includes(q) ||
      (showAllClients && (l.clients?.company_name || '').toLowerCase().includes(q))
    )
  })

  const inputClass = 'bg-bg-tertiary border border-white/[0.08] rounded-btn px-2 py-1.5 w-full text-sm text-text-primary focus:outline-none focus:border-vc-primary focus:ring-1 focus:ring-vc-primary'

  return (
    <div className="p-4 md:p-6 space-y-5 w-full overflow-x-hidden">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-h2 font-heading text-text-primary">{showAllClients ? 'Client Leads' : 'Leads'}</h1>
          <p className="text-sm text-text-secondary mt-0.5">
            {leads.length} lead{leads.length === 1 ? '' : 's'}
            {showAllClients ? ' across all clients' : ' · update status and notes here'}
          </p>
        </div>
        {crmSheetUrl && (
          <a
            href={crmSheetUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 text-xs text-text-tertiary hover:text-text-primary transition-colors"
          >
            <ExternalLink size={12} />
            Open CRM sheet
          </a>
        )}
      </div>

      <div className="relative max-w-xs">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={showAllClients ? 'Search leads or client...' : 'Search leads...'}
          className="w-full pl-9 pr-3 py-2 text-sm bg-bg-tertiary border border-white/[0.08] rounded-btn text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-vc-primary focus:ring-1 focus:ring-vc-primary"
        />
      </div>

      <div className="vc-card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="vc-table min-w-[900px]">
            <thead>
              <tr>
                {showAllClients && <th>Client</th>}
                <th>Name</th>
                <th>Contact</th>
                <th>Source</th>
                <th>Package</th>
                <th>Total Paid</th>
                <th>Status</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={showAllClients ? 8 : 7} className="px-5 py-8 text-center text-sm text-text-secondary">
                    Loading leads...
                  </td>
                </tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={showAllClients ? 8 : 7} className="px-5 py-8 text-center text-sm text-text-secondary">
                    No leads yet.
                  </td>
                </tr>
              )}
              {filtered.map((lead) => (
                <tr key={lead.id}>
                  {showAllClients && (
                    <td>
                      <p className="font-medium text-text-primary">{lead.clients?.company_name || '—'}</p>
                      {lead.clients?.crm_sheet_id && (
                        <a
                          href={`https://docs.google.com/spreadsheets/d/${lead.clients.crm_sheet_id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 text-[11px] text-text-tertiary hover:text-text-primary transition-colors mt-0.5"
                        >
                          <ExternalLink size={10} />
                          Sheet
                        </a>
                      )}
                    </td>
                  )}
                  {isAdmin ? (
                    <>
                      <td>
                        <input
                          className={inputClass}
                          defaultValue={lead.name}
                          onBlur={(e) => e.target.value !== lead.name && updateLead(lead.id, { name: e.target.value })}
                        />
                      </td>
                      <td>
                        <input
                          className={inputClass}
                          defaultValue={lead.email}
                          placeholder="Email"
                          onBlur={(e) => e.target.value !== lead.email && updateLead(lead.id, { email: e.target.value })}
                        />
                      </td>
                      <td>
                        <input
                          className={inputClass}
                          defaultValue={lead.source}
                          placeholder="Source"
                          onBlur={(e) => e.target.value !== lead.source && updateLead(lead.id, { source: e.target.value })}
                        />
                      </td>
                      <td>
                        <input
                          className={inputClass}
                          defaultValue={lead.package_interest}
                          placeholder="Package"
                          onBlur={(e) => e.target.value !== lead.package_interest && updateLead(lead.id, { package_interest: e.target.value })}
                        />
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="font-medium text-text-primary">{lead.name}</td>
                      <td>
                        <p className="text-text-secondary">{lead.email}</p>
                        {lead.phone && <p className="text-xs text-text-tertiary">{lead.phone}</p>}
                      </td>
                      <td className="text-text-secondary">{lead.source || '—'}</td>
                      <td className="text-text-secondary">{lead.package_interest || '—'}</td>
                    </>
                  )}
                  <td className="mono">£{Number(lead.total_paid || 0).toLocaleString()}</td>
                  <td>
                    <select
                      value={lead.status}
                      disabled={savingId === lead.id}
                      onChange={(e) => updateLead(lead.id, { status: e.target.value })}
                      className="bg-bg-tertiary border border-white/[0.08] rounded-btn px-2 py-1 text-xs text-text-primary focus:outline-none focus:border-vc-primary"
                    >
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                    <div className="mt-1">
                      <Badge variant={STATUS_BADGE[lead.status] ?? 'default'} dot size="xs">{lead.status}</Badge>
                    </div>
                  </td>
                  <td>
                    <input
                      className={inputClass}
                      defaultValue={lead.notes || ''}
                      placeholder="Add a note..."
                      onBlur={(e) => e.target.value !== (lead.notes || '') && updateLead(lead.id, { notes: e.target.value })}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
