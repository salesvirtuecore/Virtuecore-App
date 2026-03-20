import { useState, useEffect } from 'react'
import { Globe, Plus, ExternalLink, Trash2, Copy, Check } from 'lucide-react'
import { supabase, isDemoMode } from '../../lib/supabase'
import { useToast } from '../../context/ToastContext'
import Modal from '../../components/ui/Modal'
import FormField from '../../components/ui/FormField'

const DEMO_WEBSITES = [
  {
    id: 'w-001',
    client_id: 'c-001',
    client_name: 'Hartley & Sons Roofing',
    name: 'Hartley Roofing Website',
    url: 'https://hartleyroofing.co.uk',
    ga_measurement_id: 'G-ABC123456',
    meta_pixel_id: '1234567890',
    notes: 'WordPress site, hosted on WP Engine',
  },
  {
    id: 'w-002',
    client_id: 'c-002',
    client_name: 'Apex Drainage Solutions',
    name: 'Apex Drainage',
    url: 'https://apexdrainage.co.uk',
    ga_measurement_id: 'G-XYZ987654',
    meta_pixel_id: '',
    notes: 'Webflow site',
  },
]

const EMPTY_FORM = {
  client_id: '',
  name: '',
  url: '',
  ga_measurement_id: '',
  meta_pixel_id: '',
  notes: '',
}

export default function WebAnalytics() {
  const { showToast } = useToast()
  const [websites, setWebsites] = useState(isDemoMode ? DEMO_WEBSITES : [])
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(!isDemoMode)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [copiedId, setCopiedId] = useState(null)
  const [scriptSiteId, setScriptSiteId] = useState(null)

  useEffect(() => {
    if (isDemoMode || !supabase) return

    setLoading(true)
    Promise.all([
      supabase
        .from('client_websites')
        .select('*, clients(company_name)')
        .order('created_at', { ascending: false }),
      supabase
        .from('clients')
        .select('id, company_name')
        .eq('status', 'active')
        .order('company_name'),
    ]).then(([{ data: siteRows }, { data: clientRows }]) => {
      if (siteRows) {
        setWebsites(
          siteRows.map((s) => ({ ...s, client_name: s.clients?.company_name ?? '—' }))
        )
      }
      if (clientRows) setClients(clientRows)
      setLoading(false)
    })
  }, [])

  async function handleSave(e) {
    e.preventDefault()
    if (!form.client_id || !form.name.trim() || !form.url.trim()) return

    setSaving(true)
    try {
      if (isDemoMode) {
        const client = clients.find((c) => c.id === form.client_id)
        setWebsites((prev) => [
          {
            ...form,
            id: `w-${Date.now()}`,
            client_name: client?.company_name ?? '—',
          },
          ...prev,
        ])
        setShowModal(false)
        setForm(EMPTY_FORM)
        return
      }

      const { data, error } = await supabase
        .from('client_websites')
        .insert({
          client_id: form.client_id,
          name: form.name.trim(),
          url: form.url.trim(),
          ga_measurement_id: form.ga_measurement_id.trim() || null,
          meta_pixel_id: form.meta_pixel_id.trim() || null,
          notes: form.notes.trim() || null,
        })
        .select('*, clients(company_name)')
        .single()

      if (error) throw error

      setWebsites((prev) => [
        { ...data, client_name: data.clients?.company_name ?? '—' },
        ...prev,
      ])
      showToast('Website added')
      setShowModal(false)
      setForm(EMPTY_FORM)
    } catch (err) {
      showToast(err.message ?? 'Failed to save website', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(site) {
    if (!confirm(`Remove ${site.name}?`)) return

    if (isDemoMode) {
      setWebsites((prev) => prev.filter((s) => s.id !== site.id))
      return
    }

    const { error } = await supabase.from('client_websites').delete().eq('id', site.id)
    if (error) {
      showToast('Failed to remove website', 'error')
    } else {
      setWebsites((prev) => prev.filter((s) => s.id !== site.id))
      showToast('Website removed')
    }
  }

  function copyTrackingSnippet(site) {
    const snippet = site.ga_measurement_id
      ? `<!-- Google Analytics (${site.name}) -->\n<script async src="https://www.googletagmanager.com/gtag/js?id=${site.ga_measurement_id}"></script>\n<script>\n  window.dataLayer = window.dataLayer || [];\n  function gtag(){dataLayer.push(arguments);}\n  gtag('js', new Date());\n  gtag('config', '${site.ga_measurement_id}');\n</script>`
      : `<!-- No GA Measurement ID set for ${site.name} -->`

    navigator.clipboard.writeText(snippet).then(() => {
      setCopiedId(site.id)
      setTimeout(() => setCopiedId(null), 2000)
    })
  }

  // Group websites by client
  const byClient = websites.reduce((acc, site) => {
    const key = site.client_name
    if (!acc[key]) acc[key] = []
    acc[key].push(site)
    return acc
  }, {})

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-vc-text">Web Analytics</h1>
          <p className="text-sm text-vc-muted mt-0.5">Websites hosted and maintained for clients</p>
        </div>
        <button
          onClick={() => { setForm(EMPTY_FORM); setShowModal(true) }}
          className="flex items-center gap-1.5 bg-gold hover:bg-amber-600 text-white text-sm px-4 py-2 transition-colors"
        >
          <Plus size={14} />
          Add Website
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-vc-muted">Loading websites...</p>
      ) : websites.length === 0 ? (
        <div className="border border-dashed border-vc-border p-10 text-center text-sm text-vc-muted">
          No websites added yet. Click <span className="font-medium">Add Website</span> to track a client site.
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(byClient).map(([clientName, sites]) => (
            <div key={clientName}>
              <p className="text-xs font-semibold text-vc-muted uppercase tracking-wide mb-2">{clientName}</p>
              <div className="space-y-3">
                {sites.map((site) => (
                  <div key={site.id} className="border border-vc-border">
                    <div className="p-4 flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="w-8 h-8 bg-vc-secondary border border-vc-border flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Globe size={15} className="text-vc-muted" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-vc-text">{site.name}</p>
                          <a
                            href={site.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs text-gold hover:underline mt-0.5"
                          >
                            {site.url}
                            <ExternalLink size={10} />
                          </a>
                          {site.notes && (
                            <p className="text-xs text-vc-muted mt-1">{site.notes}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          onClick={() => setScriptSiteId(scriptSiteId === site.id ? null : site.id)}
                          className="text-xs text-vc-muted hover:text-vc-text border border-vc-border px-2 py-1 transition-colors"
                        >
                          Tracking
                        </button>
                        <button
                          onClick={() => handleDelete(site)}
                          className="text-vc-muted hover:text-red-500 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    {/* Tracking IDs row */}
                    <div className="border-t border-vc-border px-4 py-2.5 flex flex-wrap gap-4 bg-vc-secondary">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-vc-muted">GA4:</span>
                        <span className="text-xs font-mono text-vc-text">
                          {site.ga_measurement_id || <span className="text-vc-muted italic">Not set</span>}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-vc-muted">Meta Pixel:</span>
                        <span className="text-xs font-mono text-vc-text">
                          {site.meta_pixel_id || <span className="text-vc-muted italic">Not set</span>}
                        </span>
                      </div>
                    </div>

                    {/* Tracking snippet panel */}
                    {scriptSiteId === site.id && (
                      <div className="border-t border-vc-border p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-medium text-vc-text">GA4 Tracking Snippet</p>
                          <button
                            onClick={() => copyTrackingSnippet(site)}
                            className="flex items-center gap-1 text-xs text-vc-muted hover:text-vc-text transition-colors"
                          >
                            {copiedId === site.id ? <Check size={12} className="text-green-600" /> : <Copy size={12} />}
                            {copiedId === site.id ? 'Copied!' : 'Copy'}
                          </button>
                        </div>
                        {site.ga_measurement_id ? (
                          <pre className="text-xs font-mono bg-vc-secondary border border-vc-border p-3 overflow-x-auto text-vc-muted leading-relaxed">{`<!-- Google Analytics (${site.name}) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=${site.ga_measurement_id}"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', '${site.ga_measurement_id}');
</script>`}</pre>
                        ) : (
                          <p className="text-xs text-vc-muted">
                            Add a GA4 Measurement ID to generate the tracking snippet.
                          </p>
                        )}
                        {site.ga_measurement_id && (
                          <a
                            href={`https://analytics.google.com/analytics/web/#/p${site.ga_measurement_id.replace('G-', '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs text-gold hover:underline"
                          >
                            Open in Google Analytics
                            <ExternalLink size={10} />
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Website Modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Add Website" size="md">
        <form onSubmit={handleSave} className="space-y-4">
          <FormField label="Client" required>
            <select
              className="w-full border border-vc-border px-3 py-2 text-sm focus:outline-none focus:border-gold bg-white"
              value={form.client_id}
              onChange={(e) => setForm((p) => ({ ...p, client_id: e.target.value }))}
              required
            >
              <option value="">Select client...</option>
              {isDemoMode
                ? [{ id: 'c-001', company_name: 'Hartley & Sons Roofing' }, { id: 'c-002', company_name: 'Apex Drainage Solutions' }].map((c) => (
                    <option key={c.id} value={c.id}>{c.company_name}</option>
                  ))
                : clients.map((c) => (
                    <option key={c.id} value={c.id}>{c.company_name}</option>
                  ))}
            </select>
          </FormField>

          <FormField label="Website name" required>
            <input
              className="w-full border border-vc-border px-3 py-2 text-sm focus:outline-none focus:border-gold"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="e.g. Hartley Roofing Website"
              required
            />
          </FormField>

          <FormField label="URL" required>
            <input
              className="w-full border border-vc-border px-3 py-2 text-sm focus:outline-none focus:border-gold"
              value={form.url}
              onChange={(e) => setForm((p) => ({ ...p, url: e.target.value }))}
              placeholder="https://example.co.uk"
              required
            />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="GA4 Measurement ID">
              <input
                className="w-full border border-vc-border px-3 py-2 text-sm focus:outline-none focus:border-gold"
                value={form.ga_measurement_id}
                onChange={(e) => setForm((p) => ({ ...p, ga_measurement_id: e.target.value }))}
                placeholder="G-XXXXXXXXXX"
              />
            </FormField>
            <FormField label="Meta Pixel ID">
              <input
                className="w-full border border-vc-border px-3 py-2 text-sm focus:outline-none focus:border-gold"
                value={form.meta_pixel_id}
                onChange={(e) => setForm((p) => ({ ...p, meta_pixel_id: e.target.value }))}
                placeholder="1234567890"
              />
            </FormField>
          </div>

          <FormField label="Notes">
            <input
              className="w-full border border-vc-border px-3 py-2 text-sm focus:outline-none focus:border-gold"
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
              placeholder="Platform, host, anything useful..."
            />
          </FormField>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="px-4 py-2 text-sm text-vc-muted hover:text-vc-text border border-vc-border transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !form.client_id || !form.name.trim() || !form.url.trim()}
              className="px-4 py-2 text-sm bg-gold hover:bg-amber-600 text-white disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving...' : 'Add website'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
