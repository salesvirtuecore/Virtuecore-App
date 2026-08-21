import { authenticateUser, requireClientOwnership, requireRole, checkRateLimit } from '../_lib/auth.js'

// Real deploy/site status per client_websites row with a netlify_site_id set.
// Note: Netlify's visitor-traffic Analytics is a separate paid add-on with its
// own endpoint — this only surfaces what's available on every plan (site info
// + latest deploy state), not paid traffic analytics.
async function fetchNetlifySite(siteId, token) {
  const res = await fetch(`https://api.netlify.com/api/v1/sites/${siteId}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    if (res.status === 404) return { error: 'Netlify site not found — check the site ID' }
    return { error: `Netlify API error (${res.status})` }
  }
  const site = await res.json()
  return {
    name: site.name,
    url: site.ssl_url || site.url,
    adminUrl: site.admin_url,
    state: site.state,
    lastDeployedAt: site.updated_at || null,
    screenshotUrl: site.screenshot_url || null,
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
