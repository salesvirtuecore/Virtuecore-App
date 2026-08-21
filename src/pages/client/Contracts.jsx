import { useEffect, useState } from 'react'
import { FileText, Upload } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { supabase } from '../../lib/supabase'
import { apiFetch } from '../../lib/api'
import { uploadClientDocument } from '../../lib/clientUtils'

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function Contracts() {
  const { profile } = useAuth()
  const { showToast } = useToast()
  const [contracts, setContracts] = useState([])
  const [loading, setLoading] = useState(true)
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)

  async function loadContracts() {
    if (!supabase || !profile?.client_id) { setLoading(false); return }
    setLoading(true)
    const { data, error } = await supabase.from('contracts')
      .select('id, file_name, status, created_at')
      .eq('client_id', profile.client_id)
      .order('created_at', { ascending: false })
    if (!error) setContracts(data || [])
    setLoading(false)
  }

  useEffect(() => {
    loadContracts()
  }, [profile?.client_id])

  async function handleUpload(e) {
    e.preventDefault()
    if (!file) return showToast('Choose a file first', 'error')
    setUploading(true)
    try {
      const filePath = await uploadClientDocument(supabase, profile.client_id, 'contracts', file)
      const res = await apiFetch('/api/onboarding/submit-contract', {
        method: 'POST',
        body: JSON.stringify({ file_path: filePath, file_name: file.name }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Upload failed')
      showToast('Contract uploaded')
      setFile(null)
      loadContracts()
    } catch (err) {
      showToast(err.message || 'Upload failed', 'error')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="p-4 md:p-6 space-y-5 w-full overflow-x-hidden">
      <div>
        <h1 className="text-h2 font-heading text-text-primary">Contracts</h1>
        <p className="text-sm text-text-secondary mt-0.5">Upload your signed contract with VirtueCore.</p>
      </div>

      <div className="vc-card">
        <form onSubmit={handleUpload} className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="text-xs text-text-secondary flex-1"
          />
          <button
            type="submit"
            disabled={uploading}
            className="text-xs px-4 py-2 bg-vc-primary text-white hover:bg-vc-accent rounded transition-colors disabled:opacity-60 flex items-center gap-1.5 flex-shrink-0"
          >
            <Upload size={12} /> {uploading ? 'Uploading...' : 'Upload contract'}
          </button>
        </form>
      </div>

      <div className="vc-card">
        <h2 className="text-sm font-semibold text-text-primary mb-3">Your uploads</h2>
        {loading ? (
          <p className="text-sm text-text-secondary">Loading...</p>
        ) : contracts.length === 0 ? (
          <p className="text-sm text-text-secondary">No contracts uploaded yet.</p>
        ) : (
          <div className="space-y-2">
            {contracts.map((c) => (
              <div key={c.id} className="flex items-center gap-3 px-3 py-2 bg-bg-tertiary rounded">
                <FileText size={16} className="text-text-secondary flex-shrink-0" />
                <span className="text-sm text-text-primary flex-1 truncate">{c.file_name || 'contract.pdf'}</span>
                <span className="text-xs text-text-secondary flex-shrink-0">{formatDate(c.created_at)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
