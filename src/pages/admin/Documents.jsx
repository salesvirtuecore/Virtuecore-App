import { useEffect, useState } from 'react'
import { FileText, ExternalLink, Eye, EyeOff, Copy } from 'lucide-react'
import { useToast } from '../../context/ToastContext'
import { supabase } from '../../lib/supabase'
import { apiFetch } from '../../lib/api'
import { getSignedDocumentUrl } from '../../lib/clientUtils'

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function Documents() {
  const { showToast } = useToast()
  const [tab, setTab] = useState('contracts')
  const [contracts, setContracts] = useState([])
  const [credentials, setCredentials] = useState([])
  const [logins, setLogins] = useState([])
  const [revealed, setRevealed] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const [contractsRes, credsRes, loginsRes] = await Promise.all([
          apiFetch('/api/onboarding/admin-list-contracts'),
          apiFetch('/api/onboarding/admin-list-credentials'),
          apiFetch('/api/onboarding/admin-list-login-credentials'),
        ])
        const contractsData = await contractsRes.json()
        const credsData = await credsRes.json()
        const loginsData = await loginsRes.json()
        if (contractsRes.ok) setContracts(contractsData.contracts || [])
        if (credsRes.ok) setCredentials(credsData.credentials || [])
        if (loginsRes.ok) setLogins(loginsData.logins || [])
      } catch {
        showToast('Failed to load documents', 'error')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  async function revealLoginPassword(id) {
    if (revealed[id]) return setRevealed((prev) => ({ ...prev, [id]: null }))
    try {
      const res = await apiFetch('/api/onboarding/admin-reveal-login-password', {
        method: 'POST',
        body: JSON.stringify({ id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to reveal password')
      setRevealed((prev) => ({ ...prev, [id]: data.password }))
    } catch (err) {
      showToast(err.message || 'Failed to reveal password', 'error')
    }
  }

  async function copyLoginPassword(id) {
    const password = revealed[id]
    if (!password) return
    try {
      await navigator.clipboard.writeText(password)
      showToast('Password copied')
    } catch {
      showToast('Could not copy password', 'error')
    }
  }

  async function openDocument(filePath) {
    try {
      const url = await getSignedDocumentUrl(supabase, filePath)
      window.open(url, '_blank', 'noreferrer')
    } catch {
      showToast('Could not open document', 'error')
    }
  }

  async function updateContractStatus(contractId, status) {
    try {
      const res = await apiFetch('/api/onboarding/update-contract-status', {
        method: 'POST',
        body: JSON.stringify({ contract_id: contractId, status }),
      })
      if (!res.ok) throw new Error()
      setContracts((prev) => prev.map((c) => (c.id === contractId ? { ...c, status } : c)))
      showToast(`Marked ${status}`)
    } catch {
      showToast('Failed to update status', 'error')
    }
  }

  const tabs = [
    { key: 'contracts', label: `Contracts (${contracts.length})` },
    { key: 'credentials', label: `Credentials (${credentials.length})` },
    { key: 'logins', label: `Logins (${logins.length})` },
  ]

  return (
    <div className="p-4 md:p-6 space-y-5 w-full overflow-x-hidden">
      <div>
        <h1 className="text-h2 font-heading text-text-primary">Client Documents</h1>
        <p className="text-sm text-text-secondary mt-0.5">Signed contracts and login/credentials submissions from every client, in one place.</p>
      </div>

      <div className="flex gap-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`text-xs px-3 py-1.5 rounded transition-colors ${tab === t.key ? 'bg-vc-primary text-white' : 'bg-bg-tertiary text-text-secondary hover:text-text-primary'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="vc-card">
        {loading ? (
          <p className="text-sm text-text-secondary">Loading...</p>
        ) : tab === 'contracts' ? (
          contracts.length === 0 ? (
            <p className="text-sm text-text-secondary">No contracts submitted yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="vc-table w-full">
                <thead>
                  <tr>
                    <th>Client</th>
                    <th>File</th>
                    <th>Status</th>
                    <th>Submitted</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {contracts.map((c) => (
                    <tr key={c.id}>
                      <td className="whitespace-nowrap">{c.clients?.company_name || '—'}</td>
                      <td className="flex items-center gap-2 whitespace-nowrap"><FileText size={14} className="text-text-secondary" />{c.file_name || 'contract.pdf'}</td>
                      <td className="whitespace-nowrap">
                        <select
                          value={c.status}
                          onChange={(e) => updateContractStatus(c.id, e.target.value)}
                          className="text-xs bg-bg-tertiary border border-white/[0.08] rounded px-2 py-1 text-text-primary capitalize"
                        >
                          <option value="submitted">Submitted</option>
                          <option value="signed">Signed</option>
                          <option value="archived">Archived</option>
                        </select>
                      </td>
                      <td className="whitespace-nowrap">{formatDate(c.created_at)}</td>
                      <td className="whitespace-nowrap">
                        <button onClick={() => openDocument(c.file_path)} className="text-vc-primary hover:underline text-xs flex items-center gap-1">
                          <ExternalLink size={12} /> View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : tab === 'credentials' ? (
          credentials.length === 0 ? (
            <p className="text-sm text-text-secondary">No credentials submitted yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="vc-table w-full">
                <thead>
                  <tr>
                    <th>Client</th>
                    <th>Type</th>
                    <th>Doc / Link</th>
                    <th>Notes</th>
                    <th>Submitted</th>
                  </tr>
                </thead>
                <tbody>
                  {credentials.map((c) => (
                    <tr key={c.id}>
                      <td className="whitespace-nowrap">{c.clients?.company_name || '—'}</td>
                      <td className="whitespace-nowrap capitalize">{c.doc_type === 'file' ? 'Uploaded file' : 'Google Doc link'}</td>
                      <td className="whitespace-nowrap">
                        {c.doc_type === 'file' ? (
                          <button onClick={() => openDocument(c.file_path)} className="text-vc-primary hover:underline text-xs flex items-center gap-1">
                            <ExternalLink size={12} /> View
                          </button>
                        ) : (
                          <a href={c.external_link} target="_blank" rel="noreferrer" className="text-vc-primary hover:underline text-xs flex items-center gap-1">
                            <ExternalLink size={12} /> Open
                          </a>
                        )}
                      </td>
                      <td className="max-w-xs truncate">{c.notes || '—'}</td>
                      <td className="whitespace-nowrap">{formatDate(c.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : logins.length === 0 ? (
          <p className="text-sm text-text-secondary">No logins submitted yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="vc-table w-full">
              <thead>
                <tr>
                  <th>Client</th>
                  <th>App</th>
                  <th>Email</th>
                  <th>Password</th>
                  <th>Notes</th>
                  <th>Submitted</th>
                </tr>
              </thead>
              <tbody>
                {logins.map((l, i) => {
                  const prev = logins[i - 1]
                  const newGroup = !prev || prev.group_id !== l.group_id
                  return (
                    <tr key={l.id} className={newGroup && i > 0 ? 'border-t-2 border-white/[0.08]' : ''}>
                      <td className="whitespace-nowrap">{l.clients?.company_name || '—'}</td>
                      <td className="whitespace-nowrap">{l.app_name}</td>
                      <td className="whitespace-nowrap">{l.login_email}</td>
                      <td className="whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs">{revealed[l.id] || '••••••••'}</span>
                          <button onClick={() => revealLoginPassword(l.id)} className="text-text-tertiary hover:text-text-primary">
                            {revealed[l.id] ? <EyeOff size={13} /> : <Eye size={13} />}
                          </button>
                          {revealed[l.id] && (
                            <button onClick={() => copyLoginPassword(l.id)} className="text-text-tertiary hover:text-text-primary">
                              <Copy size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="max-w-xs truncate">{l.notes || '—'}</td>
                      <td className="whitespace-nowrap">{formatDate(l.created_at)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
