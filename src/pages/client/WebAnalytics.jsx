import { useState, useEffect } from 'react'
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { BarChart2, ExternalLink, Copy, Check, Globe } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { apiFetch } from '../../lib/api'

function formatBytes(bytes) {
  if (!bytes) return '0 MB'
  const mb = bytes / (1024 * 1024)
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`
  return `${mb.toFixed(1)} MB`
}

const TrafficTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-bg-elevated border border-white/[0.08] rounded px-3 py-2 text-xs shadow-elevated space-y-1">
      <p className="text-text-secondary">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="font-mono-data font-semibold" style={{ color: p.stroke || p.fill }}>
          {p.name}: {typeof p.value === 'number' ? p.value.toLocaleString() : p.value}
        </p>
      ))}
    </div>
  )
}

const BandwidthTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-bg-elevated border border-white/[0.08] rounded px-3 py-2 text-xs shadow-elevated">
      <p className="text-text-secondary">{label}</p>
      <p className="font-mono-data font-semibold text-vc-accent">{payload[0].value.toLocaleString()} MB</p>
    </div>
  )
}

function RankingTable({ title, rows, labelKey }) {
  if (!rows?.length) return null
  return (
    <div>
      <p className="text-xs font-medium text-text-primary mb-2">{title}</p>
      <div className="border border-white/[0.06] divide-y divide-white/[0.06]">
        {rows.slice(0, 8).map((row, i) => (
          <div key={i} className="flex items-center justify-between gap-3 px-3 py-1.5 text-xs">
            <span className="text-text-secondary truncate">{row[labelKey]}</span>
            <span className="text-text-primary font-mono-data flex-shrink-0">{row.count.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function NetlifyTrafficPanel({ traffic }) {
  if (!traffic) return null
  const hasData = traffic.pageviews > 0 || traffic.visitors > 0
  if (!hasData) {
    return (
      <p className="text-xs text-text-secondary italic">
        No traffic data available — either Netlify Analytics isn't enabled for this site, or there hasn't been any traffic yet.
      </p>
    )
  }
  const bandwidthChartData = (traffic.bandwidthSeries || []).map((row) => ({
    ...row,
    mb: Number((row.bytes / (1024 * 1024)).toFixed(2)),
  }))
  return (
    <div className="space-y-5">
      <p className="text-xs font-medium text-text-primary">Traffic (last {traffic.days} days, via Netlify Analytics)</p>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <p className="text-text-tertiary text-[11px]">Pageviews</p>
          <p className="text-lg font-semibold text-text-primary font-mono-data">{traffic.pageviews.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-text-tertiary text-[11px]">Unique visitors</p>
          <p className="text-lg font-semibold text-text-primary font-mono-data">{traffic.visitors.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-text-tertiary text-[11px]">Bandwidth used</p>
          <p className="text-lg font-semibold text-text-primary font-mono-data">{formatBytes(traffic.bandwidthBytes)}</p>
        </div>
      </div>

      {/* Pageviews & Visitors trend */}
      <div>
        <p className="text-xs font-medium text-text-primary mb-2">Pageviews & Visitors</p>
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={traffic.series}>
            <defs>
              <linearGradient id="pvGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6C5CE7" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#6C5CE7" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="visGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#A29BFE" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#A29BFE" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#5A5A5E' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 11, fill: '#5A5A5E' }} axisLine={false} tickLine={false} width={36} />
            <Tooltip content={<TrafficTooltip />} />
            <Area type="monotone" dataKey="pageviews" stroke="#6C5CE7" strokeWidth={2.5} fill="url(#pvGrad)" dot={false} activeDot={{ r: 4, fill: '#6C5CE7' }} name="Pageviews" isAnimationActive animationDuration={900} animationEasing="ease-out" />
            <Area type="monotone" dataKey="visitors" stroke="#A29BFE" strokeWidth={2} fill="url(#visGrad)" dot={false} activeDot={{ r: 4, fill: '#A29BFE' }} name="Visitors" isAnimationActive animationBegin={150} animationDuration={900} animationEasing="ease-out" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Bandwidth per day */}
      {bandwidthChartData.length > 0 && (
        <div>
          <p className="text-xs font-medium text-text-primary mb-2">Bandwidth used per day</p>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={bandwidthChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#5A5A5E' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 11, fill: '#5A5A5E' }} axisLine={false} tickLine={false} width={40} />
              <Tooltip content={<BandwidthTooltip />} />
              <Bar dataKey="mb" fill="#6C5CE7" radius={[3, 3, 0, 0]} name="Bandwidth (MB)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Rankings */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <RankingTable title="Top Locations" rows={traffic.topCountries} labelKey="name" />
        <RankingTable title="Top Pages" rows={traffic.topPages} labelKey="path" />
        <RankingTable title="Top Resources Not Found" rows={traffic.topNotFound} labelKey="path" />
        <RankingTable title="Top Sources" rows={traffic.topSources} labelKey="name" />
      </div>
    </div>
  )
}

export default function ClientWebAnalytics() {
  const { profile } = useAuth()
  const [sites, setSites] = useState([])
  const [loading, setLoading] = useState(true)
  const [copiedId, setCopiedId] = useState(null)
  const [openSnippet, setOpenSnippet] = useState(null)
  const [gaInput, setGaInput] = useState({})
  const [saving, setSaving] = useState(null)
  const [netlifyBySite, setNetlifyBySite] = useState({})

  const clientId = profile?.client_id

  useEffect(() => {
    if (!supabase || !clientId) { setLoading(false); return }
    supabase
      .from('client_websites')
      .select('id, client_id, name, url, ga_measurement_id, meta_pixel_id, netlify_site_id, notes, created_at')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (data) setSites(data)
        setLoading(false)
      })
  }, [clientId])

  useEffect(() => {
    if (!clientId) return
    apiFetch(`/api/netlify/status?client_id=${clientId}`)
      .then((r) => r.json())
      .then((data) => {
        if (!data.connected) return
        const bySite = {}
        for (const s of data.sites || []) bySite[s.id] = s.netlify
        setNetlifyBySite(bySite)
      })
      .catch(() => {})
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

                  {/* Website hosting (Netlify) */}
                  <div className="flex items-center gap-2 text-xs flex-wrap">
                    <span className="text-text-secondary">Hosting:</span>
                    {!site.netlify_site_id ? (
                      <span className="text-text-secondary italic">Not connected yet</span>
                    ) : netlifyBySite[site.id] === undefined ? (
                      <span className="text-text-secondary italic">Loading...</span>
                    ) : netlifyBySite[site.id]?.error ? (
                      <span className="text-status-danger">{netlifyBySite[site.id].error}</span>
                    ) : netlifyBySite[site.id] ? (
                      <>
                        <span className="px-1.5 py-0.5 rounded bg-status-success/10 text-status-success capitalize">{netlifyBySite[site.id].state || 'live'}</span>
                        <span className="text-text-secondary">
                          Last deployed {netlifyBySite[site.id].lastDeployedAt ? new Date(netlifyBySite[site.id].lastDeployedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'unknown'}
                        </span>
                        {netlifyBySite[site.id].adminUrl && (
                          <a href={netlifyBySite[site.id].adminUrl} target="_blank" rel="noreferrer" className="text-vc-accent hover:underline flex items-center gap-1">
                            Netlify dashboard <ExternalLink size={10} />
                          </a>
                        )}
                      </>
                    ) : (
                      <span className="text-text-secondary italic">Deploy data not connected yet</span>
                    )}
                  </div>

                  {/* Netlify traffic analytics */}
                  {netlifyBySite[site.id] && !netlifyBySite[site.id]?.error && (
                    <div className="border-t border-white/[0.06] pt-3">
                      <NetlifyTrafficPanel traffic={netlifyBySite[site.id].traffic} />
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
