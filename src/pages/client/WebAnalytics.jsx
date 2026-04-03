import { useState, useEffect } from 'react'
import { BarChart2, ExternalLink, Copy, Check, Globe } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'

export default function ClientWebAnalytics() {
  const { profile } = useAuth()
  const [sites, setSites] = useState([])
  const [loading, setLoading] = useState(true)
  const [copiedId, setCopiedId] = useState(null)
  const [openSnippet, setOpenSnippet] = useState(null)
  const [gaInput, setGaInput] = useState({})
  const [saving, setSaving] = useState(null)

  const clientId = profile?.client_id

  useEffect(() => {
    if (!supabase || !clientId) { setLoading(false); return }
    supabase
      .from('client_websites')
      .select('id, client_id, name, url, ga_measurement_id, meta_pixel_id, notes, created_at')
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
      await supabase
        .from('client_websites')
        .update({ ga_measurement_id: value || null })
        .eq('id', site.id)
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

  if (loading) return (
    <div className="p-4 md:p-6 space-y-5 w-full overflow-x-hidden animate-pulse">
      <div className="space-y-1">
        <div className="h-7 w-40 bg-bg-tertiary rounded" />
        <div className="h-4 w-64 bg-bg-tertiary rounded" />
      </div>
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="border border-white/[0.06] p-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-bg-tertiary rounded flex-shrink-0" />
            <div className="space-y-1 flex-1">
              <div className="h-4 w-40 bg-bg-tertiary rounded" />
              <div className="h-3 w-28 bg-bg-tertiary rounded" />
            </div>
          </div>
          <div className="h-10 bg-bg-tertiary rounded" />
        </div>
      ))}
    </div>
  )

  return (
    <div className="p-4 md:p-6 space-y-5 w-full overflow-x-hidden">
      <div>
        <h1 className="text-h2 font-heading text-text-primary">Web Analytics</h1>
        <p className="text-sm text-text-secondary mt-0.5">Track and view your website performance</p>
      </div>

      {sites.length === 0 ? (
        <div className="border border-dashed border-white/[0.06] p-10 text-center">
          <Globe size={28} className="text-text-secondary mx-auto mb-3" />
          <p className="text-sm text-text-primary font-medium mb-1">No websites set up yet</p>
          <p className="text-sm text-text-secondary">Contact your VirtueCore team to connect your website.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {sites.map((site) => {
            const gaId = gaInput[site.id] !== undefined ? gaInput[site.id] : (site.ga_measurement_id ?? '')
            const hasChanged = gaInput[site.id] !== undefined && gaInput[site.id] !== (site.ga_measurement_id ?? '')
            return (
              <div key={site.id} className="border border-white/[0.06]">
                {/* Header */}
                <div className="p-4 flex items-start gap-3">
                  <div className="w-8 h-8 bg-bg-tertiary border border-white/[0.06] flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Globe size={15} className="text-text-secondary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-text-primary">{site.name}</p>
                    <a
                      href={site.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-vc-accent hover:underline mt-0.5"
                    >
                      {site.url}
                      <ExternalLink size={10} />
                    </a>
                    {site.notes && <p className="text-xs text-text-secondary mt-1">{site.notes}</p>}
                  </div>
                </div>

                {/* GA4 ID row */}
                <div className="border-t border-white/[0.06] p-4 space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1.5">Google Analytics 4 (GA4) Measurement ID</label>
                    <div className="flex gap-2">
                      <input
                        className="flex-1 border border-white/[0.06] px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-vc-primary font-mono"
                        placeholder="G-XXXXXXXXXX"
                        value={gaId}
                        onChange={(e) => setGaInput((prev) => ({ ...prev, [site.id]: e.target.value }))}
                      />
                      {hasChanged && (
                        <button
                          onClick={() => saveGaId(site)}
                          disabled={saving === site.id}
                          className="px-3 py-2 bg-vc-primary text-white text-sm hover:bg-vc-accent disabled:opacity-50 transition-colors"
                        >
                          {saving === site.id ? 'Saving...' : 'Save'}
                        </button>
                      )}
                    </div>
                    {site.ga_measurement_id && (
                      <p className="text-xs text-text-secondary mt-1.5">
                        Your GA4 ID is connected. Paste the tracking snippet below into your website's{' '}
                        <code className="font-mono">&lt;head&gt;</code> tag if not already installed.
                      </p>
                    )}
                  </div>

                  {/* Meta Pixel */}
                  {site.meta_pixel_id && (
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-text-secondary">Meta Pixel:</span>
                      <span className="font-mono text-text-primary">{site.meta_pixel_id}</span>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2 pt-1">
                    {site.ga_measurement_id && (
                      <>
                        <button
                          onClick={() => setOpenSnippet(openSnippet === site.id ? null : site.id)}
                          className="text-xs border border-white/[0.06] px-3 py-1.5 text-text-secondary hover:text-text-primary transition-colors"
                        >
                          {openSnippet === site.id ? 'Hide snippet' : 'View tracking snippet'}
                        </button>
                        <a
                          href={`https://analytics.google.com/analytics/web/`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs border border-white/[0.06] px-3 py-1.5 text-text-secondary hover:text-text-primary transition-colors"
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
                        <p className="text-xs font-medium text-text-primary">Paste this into your website's &lt;head&gt;</p>
                        <button
                          onClick={() => copySnippet(site)}
                          className="flex items-center gap-1 text-xs text-text-secondary hover:text-text-primary transition-colors"
                        >
                          {copiedId === site.id ? <Check size={12} className="text-status-success" /> : <Copy size={12} />}
                          {copiedId === site.id ? 'Copied!' : 'Copy'}
                        </button>
                      </div>
                      <pre className="text-xs font-mono bg-bg-tertiary border border-white/[0.06] p-3 overflow-x-auto text-text-secondary leading-relaxed whitespace-pre-wrap">{`<!-- Google Analytics -->
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
                  <div className="border-t border-white/[0.06] px-4 py-3 bg-bg-tertiary flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs text-text-secondary">
                      <BarChart2 size={13} />
                      <span>View live stats in your Google Analytics dashboard</span>
                    </div>
                    <a
                      href="https://analytics.google.com/analytics/web/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-vc-accent hover:underline flex items-center gap-1"
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
