import { useState, useEffect } from 'react'
import { BarChart2, ExternalLink, Copy, Check, Globe } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { supabase, isDemoMode } from '../../lib/supabase'

const DEMO_SITES = [
  {
    id: 'w-001',
    name: 'Hartley Roofing Website',
    url: 'https://hartleyroofing.co.uk',
    ga_measurement_id: 'G-ABC123456',
    meta_pixel_id: '1234567890',
    notes: 'WordPress site on WP Engine',
  },
]

export default function ClientWebAnalytics() {
  const { profile } = useAuth()
  const [sites, setSites] = useState(isDemoMode ? DEMO_SITES : [])
  const [loading, setLoading] = useState(!isDemoMode)
  const [copiedId, setCopiedId] = useState(null)
  const [openSnippet, setOpenSnippet] = useState(null)
  const [gaInput, setGaInput] = useState({})
  const [saving, setSaving] = useState(null)

  const clientId = profile?.client_id

  useEffect(() => {
    if (isDemoMode || !supabase || !clientId) return
    supabase
      .from('client_websites')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (data) setSites(data)
        setLoading(false)
      })
  }, [clientId])

  async function saveGaId(site) {
    const value = (gaInput[site.id] ?? site.ga_measurement_id ?? '').trim()
    setSaving(site.id)
    try {
      if (!isDemoMode) {
        await supabase
          .from('client_websites')
          .update({ ga_measurement_id: value || null })
          .eq('id', site.id)
      }
      setSites((prev) => prev.map((s) => s.id === site.id ? { ...s, ga_measurement_id: value || null } : s))
      setGaInput((prev) => { const n = { ...prev }; delete n[site.id]; return n })
    } finally {
      setSaving(null)
    }
  }

  function copySnippet(site) {
    const snippet = `<!-- Google Analytics -->\n<script async src="https://www.googletagmanager.com/gtag/js?id=${site.ga_measurement_id}"></script>\n<script>\n  window.dataLayer = window.dataLayer || [];\n  function gtag(){dataLayer.push(arguments);}\n  gtag('js', new Date());\n  gtag('config', '${site.ga_measurement_id}');\n</script>`
    navigator.clipboard.writeText(snippet).then(() => {
      setCopiedId(site.id)
      setTimeout(() => setCopiedId(null), 2000)
    })
  }

  if (loading) return <div className="p-6 text-sm text-vc-muted">Loading...</div>

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-vc-text">Web Analytics</h1>
        <p className="text-sm text-vc-muted mt-0.5">Track and view your website performance</p>
      </div>

      {sites.length === 0 ? (
        <div className="border border-dashed border-vc-border p-10 text-center">
          <Globe size={28} className="text-vc-muted mx-auto mb-3" />
          <p className="text-sm text-vc-text font-medium mb-1">No websites set up yet</p>
          <p className="text-sm text-vc-muted">Contact your VirtueCore team to connect your website.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {sites.map((site) => {
            const gaId = gaInput[site.id] !== undefined ? gaInput[site.id] : (site.ga_measurement_id ?? '')
            const hasChanged = gaInput[site.id] !== undefined && gaInput[site.id] !== (site.ga_measurement_id ?? '')
            return (
              <div key={site.id} className="border border-vc-border">
                {/* Header */}
                <div className="p-4 flex items-start gap-3">
                  <div className="w-8 h-8 bg-vc-secondary border border-vc-border flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Globe size={15} className="text-vc-muted" />
                  </div>
                  <div className="min-w-0 flex-1">
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
                    {site.notes && <p className="text-xs text-vc-muted mt-1">{site.notes}</p>}
                  </div>
                </div>

                {/* GA4 ID row */}
                <div className="border-t border-vc-border p-4 space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-vc-muted mb-1.5">Google Analytics 4 (GA4) Measurement ID</label>
                    <div className="flex gap-2">
                      <input
                        className="flex-1 border border-vc-border px-3 py-2 text-sm text-vc-text focus:outline-none focus:border-vc-text font-mono"
                        placeholder="G-XXXXXXXXXX"
                        value={gaId}
                        onChange={(e) => setGaInput((prev) => ({ ...prev, [site.id]: e.target.value }))}
                      />
                      {hasChanged && (
                        <button
                          onClick={() => saveGaId(site)}
                          disabled={saving === site.id}
                          className="px-3 py-2 bg-vc-text text-white text-sm hover:bg-gray-800 disabled:opacity-50 transition-colors"
                        >
                          {saving === site.id ? 'Saving...' : 'Save'}
                        </button>
                      )}
                    </div>
                    {site.ga_measurement_id && (
                      <p className="text-xs text-vc-muted mt-1.5">
                        Your GA4 ID is connected. Paste the tracking snippet below into your website's{' '}
                        <code className="font-mono">&lt;head&gt;</code> tag if not already installed.
                      </p>
                    )}
                  </div>

                  {/* Meta Pixel */}
                  {site.meta_pixel_id && (
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-vc-muted">Meta Pixel:</span>
                      <span className="font-mono text-vc-text">{site.meta_pixel_id}</span>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2 pt-1">
                    {site.ga_measurement_id && (
                      <>
                        <button
                          onClick={() => setOpenSnippet(openSnippet === site.id ? null : site.id)}
                          className="text-xs border border-vc-border px-3 py-1.5 text-vc-muted hover:text-vc-text transition-colors"
                        >
                          {openSnippet === site.id ? 'Hide snippet' : 'View tracking snippet'}
                        </button>
                        <a
                          href={`https://analytics.google.com/analytics/web/`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs border border-vc-border px-3 py-1.5 text-vc-muted hover:text-vc-text transition-colors"
                        >
                          Open Google Analytics
                          <ExternalLink size={10} />
                        </a>
                      </>
                    )}
                  </div>

                  {/* Snippet panel */}
                  {openSnippet === site.id && site.ga_measurement_id && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-medium text-vc-text">Paste this into your website's &lt;head&gt;</p>
                        <button
                          onClick={() => copySnippet(site)}
                          className="flex items-center gap-1 text-xs text-vc-muted hover:text-vc-text transition-colors"
                        >
                          {copiedId === site.id ? <Check size={12} className="text-green-600" /> : <Copy size={12} />}
                          {copiedId === site.id ? 'Copied!' : 'Copy'}
                        </button>
                      </div>
                      <pre className="text-xs font-mono bg-vc-secondary border border-vc-border p-3 overflow-x-auto text-vc-muted leading-relaxed whitespace-pre-wrap">{`<!-- Google Analytics -->
<script async src="https://www.googletagmanager.com/gtag/js?id=${site.ga_measurement_id}"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', '${site.ga_measurement_id}');
</script>`}</pre>
                    </div>
                  )}
                </div>

                {/* Stats CTA */}
                {site.ga_measurement_id && (
                  <div className="border-t border-vc-border px-4 py-3 bg-vc-secondary flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs text-vc-muted">
                      <BarChart2 size={13} />
                      <span>View live stats in your Google Analytics dashboard</span>
                    </div>
                    <a
                      href="https://analytics.google.com/analytics/web/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-gold hover:underline flex items-center gap-1"
                    >
                      Open dashboard <ExternalLink size={10} />
                    </a>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
