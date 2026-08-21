import { authenticateUser, requireClientOwnership, requireRole, checkRateLimit } from '../_lib/auth.js'

// Pulls real pageview/visitor counts from Netlify's traffic Analytics add-on
// (the paid "Web Analytics" feature). This is an UNDOCUMENTED Netlify API —
// there's no public/versioned contract for it, so it's wrapped defensively
// and degrades to `null` on any failure rather than breaking the page. Sites
// without the add-on purchased simply come back with an empty series (not
// an error), which reads to the client as "no data" rather than "broken".
async function fetchNetlifyTraffic(siteId, token, days = 30) {
  try {
    // This endpoint takes from/to as millisecond epoch timestamps, not
    // seconds — passing seconds silently "succeeds" with an empty series
    // (the implied range lands in 1970), which looks like "no traffic" when
    // the site actually has plenty. Verified against Netlify's own dashboard
    // numbers for a known site before relying on this.
    const to = Date.now()
    const from = to - days * 86400 * 1000
    const [pvRes, visRes] = await Promise.all([
      fetch(`https://analytics.services.netlify.com/v2/${siteId}/pageviews?from=${from}&to=${to}&timezone=0&resolution=day`, { headers: { Authorization: `Bearer ${token}` } }),
      fetch(`https://analytics.services.netlify.com/v2/${siteId}/visitors?from=${from}&to=${to}&timezone=0&resolution=range`, { headers: { Authorization: `Bearer ${token}` } }),
    ])
    if (!pvRes.ok || !visRes.ok) return null
    const pvData = await pvRes.json()
    const visData = await visRes.json()
    const series = (pvData.data || []).map(([ts, v]) => ({ date: new Date(ts).toISOString().split('T')[0], pageviews: Number(v || 0) }))
    const pageviews = series.reduce((sum, row) => sum + row.pageviews, 0)
    const visitors = Number((visData.data || [])[0]?.[1] || 0)
    return { days, pageviews, visitors, series }
  } catch {
    return null
  }
}

// Real deploy/site status per client_websites row with a netlify_site_id set,
// plus traffic numbers from the Analytics add-on when available.
async function fetchNetlifySite(siteId, token) {
  const res = await fetch(`https://api.netlify.com/api/v1/sites/${siteId}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    if (res.status === 404) return { error: 'Netlify site not found — check the site ID' }
    return { error: `Netlify API error (${res.status})` }
  }
  const site = await res.json()
  const traffic = await fetchNetlifyTraffic(siteId, token)
  return {
    name: site.name,
    url: site.ssl_url || site.url,
    adminUrl: site.admin_url,
    state: site.state,
    lastDeployedAt: site.updated_at || null,
    screenshotUrl: site.screenshot_url || null,
    traffic,
  }
}

async function handleStatus(req, res, profile, supabase) {
  const clientId = profile.role === 'admin' ? req.query.client_id : profile.client_id
  if (!clientId) return res.status(400).json({ error: 'client_id required' })
  if (!requireClientOwnership(res, profile, clientId)) return

  const { data: websites } = await supabase.from('client_websites')
    .select('id, name, netlify_site_id').eq('client_id', clientId)

  const token = process.env.NETLIFY_API_TOKEN
  if (!token) {
    return res.status(200).json({
      connected: false,
      reason: 'not_configured',
      sites: (websites || []).map((s) => ({ id: s.id, name: s.name, netlify_site_id: s.netlify_site_id || null })),
    })
  }

  const sites = await Promise.all((websites || []).map(async (w) => {
    if (!w.netlify_site_id) return { id: w.id, name: w.name, netlify_site_id: null, netlify: null }
    const netlify = await fetchNetlifySite(w.netlify_site_id, token)
    return { id: w.id, name: w.name, netlify_site_id: w.netlify_site_id, netlify }
  }))

  return res.status(200).json({ connected: true, sites })
}

// ── site-status (GET) — admin only, direct site-id lookup for the multi-client table ──
async function handleSiteStatus(req, res) {
  const token = process.env.NETLIFY_API_TOKEN
  if (!token) return res.status(200).json({ connected: false, reason: 'not_configured' })
  const { netlify_site_id } = req.query
  if (!netlify_site_id) return res.status(400).json({ error: 'netlify_site_id required' })
  const netlify = await fetchNetlifySite(netlify_site_id, token)
  return res.status(200).json({ connected: true, netlify })
}

export default async function handler(req, res) {
  if (!checkRateLimit(req, res)) return
  const auth = await authenticateUser(req, res)
  if (!auth) return
  const { profile, supabase } = auth
  const action = req.query.action

  if (action === 'status') return handleStatus(req, res, profile, supabase)
  if (action === 'site-status') {
    if (!requireRole(res, profile, 'admin')) return
    return handleSiteStatus(req, res)
  }
  res.status(404).json({ error: 'Unknown action' })
}
