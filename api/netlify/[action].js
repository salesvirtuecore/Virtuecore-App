import { authenticateUser, requireClientOwnership, requireRole, checkRateLimit } from '../_lib/auth.js'

// Pulls real pageview/visitor counts from Netlify's traffic Analytics add-on
// (the paid "Web Analytics" feature). This is an UNDOCUMENTED Netlify API —
// there's no public/versioned contract for it, so it's wrapped defensively
// and degrades to `null` on any failure rather than breaking the page. Sites
// without the add-on purchased simply come back with an empty series (not
// an error), which reads to the client as "no data" rather than "broken".
function dayKey(msTimestamp) {
  return new Date(msTimestamp).toISOString().split('T')[0]
}

function dayLabel(dateKey) {
  return new Date(dateKey).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
}

// A ranking endpoint call that never throws and never blocks the others —
// any single one failing (e.g. Netlify changes/removes it) just means that
// one panel comes back empty, not that the whole page breaks.
async function fetchRanking(url, headers) {
  try {
    const res = await fetch(url, { headers })
    if (!res.ok) return []
    const json = await res.json()
    return json.data || []
  } catch {
    return []
  }
}

async function fetchNetlifyTraffic(siteId, token, days = 30) {
  try {
    // These endpoints take from/to as millisecond epoch timestamps, not
    // seconds — passing seconds silently "succeeds" with an empty series
    // (the implied range lands in 1970), which looks like "no traffic" when
    // the site actually has plenty. Verified against Netlify's own dashboard
    // numbers for a known site before relying on this.
    const to = Date.now()
    const from = to - days * 86400 * 1000
    const common = `from=${from}&to=${to}&timezone=0`
    const headers = { Authorization: `Bearer ${token}` }

    const [pvRes, visRes, visRangeRes, bwRes, topCountries, topPages, topNotFound, topSources] = await Promise.all([
      fetch(`https://analytics.services.netlify.com/v2/${siteId}/pageviews?${common}&resolution=day`, { headers }),
      fetch(`https://analytics.services.netlify.com/v2/${siteId}/visitors?${common}&resolution=day`, { headers }),
      fetch(`https://analytics.services.netlify.com/v2/${siteId}/visitors?${common}&resolution=range`, { headers }),
      fetch(`https://analytics.services.netlify.com/v2/${siteId}/bandwidth?${common}&resolution=hour`, { headers }),
      fetchRanking(`https://analytics.services.netlify.com/v2/${siteId}/ranking/countries?${common}`, headers),
      fetchRanking(`https://analytics.services.netlify.com/v2/${siteId}/ranking/pages?${common}&limit=10`, headers),
      fetchRanking(`https://analytics.services.netlify.com/v2/${siteId}/ranking/not_found?${common}&limit=10`, headers),
      fetchRanking(`https://analytics.services.netlify.com/v2/${siteId}/ranking/sources?${common}&limit=10`, headers),
    ])

    // Pageviews + visitors day-series are the core of the traffic chart —
    // if either of those fails, treat the whole traffic block as unavailable.
    if (!pvRes.ok || !visRes.ok) return null
    const pvData = await pvRes.json()
    const visData = await visRes.json()
    const visRangeData = visRangeRes.ok ? await visRangeRes.json() : null
    const bwData = bwRes.ok ? await bwRes.json() : null

    const pvByDate = new Map((pvData.data || []).map(([ts, v]) => [dayKey(ts), Number(v || 0)]))
    const visByDate = new Map((visData.data || []).map(([ts, v]) => [dayKey(ts), Number(v || 0)]))
    const allDates = [...new Set([...pvByDate.keys(), ...visByDate.keys()])].sort()
    const series = allDates.map((date) => ({
      date,
      label: dayLabel(date),
      pageviews: pvByDate.get(date) || 0,
      visitors: visByDate.get(date) || 0,
    }))
    const pageviews = series.reduce((sum, row) => sum + row.pageviews, 0)
    // Summing daily uniques would double-count a visitor active on multiple
    // days — use the dedicated range-resolution total instead for the real
    // period-wide unique count (falls back to the daily sum if that call failed).
    const visitors = visRangeData
      ? Number((visRangeData.data || [])[0]?.[1] || 0)
      : series.reduce((sum, row) => sum + row.visitors, 0)

    // Bandwidth is additive (unlike unique visitors), so summing hourly
    // buckets per day gives both an accurate daily bar chart AND an accurate
    // total from the same single call.
    const bwByDate = new Map()
    for (const row of bwData?.data || []) {
      const date = dayKey(row.start)
      bwByDate.set(date, (bwByDate.get(date) || 0) + Number(row.siteBandwidth || 0))
    }
    const bandwidthSeries = [...bwByDate.keys()].sort().map((date) => ({
      date,
      label: dayLabel(date),
      bytes: bwByDate.get(date),
    }))
    const bandwidthBytes = bandwidthSeries.reduce((sum, row) => sum + row.bytes, 0)

    return {
      days,
      pageviews,
      visitors,
      bandwidthBytes,
      series,
      bandwidthSeries,
      topCountries: topCountries.map((r) => ({ name: r.country_name, code: r.resource, count: r.count })),
      topPages: topPages.map((r) => ({ path: r.resource, count: r.count })),
      topNotFound: topNotFound.map((r) => ({ path: r.resource, count: r.count })),
      topSources: topSources.map((r) => ({ name: r.resource || 'Direct traffic', count: r.count })),
    }
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
