import { authenticateUser, requireClientOwnership, checkRateLimit } from '../_lib/auth.js'

// Stubbed until a Netlify API token is configured — returns a clear
// "not connected" status rather than pretending to have live data.
async function handleStatus(req, res, profile, supabase) {
  const clientId = profile.role === 'admin' ? req.query.client_id : profile.client_id
  if (!clientId) return res.status(400).json({ error: 'client_id required' })
  if (!requireClientOwnership(res, profile, clientId)) return

  const { data: sites } = await supabase.from('client_websites')
    .select('id, name, netlify_site_id').eq('client_id', clientId)

  if (!process.env.NETLIFY_API_TOKEN) {
    return res.status(200).json({
      connected: false,
      reason: 'not_configured',
      sites: (sites || []).map((s) => ({ id: s.id, name: s.name, netlify_site_id: s.netlify_site_id || null })),
    })
  }

  // Real Netlify API calls (deploys, traffic) get wired in here once
  // NETLIFY_API_TOKEN is set — deliberately not built ahead of having a real token.
  return res.status(200).json({ connected: false, reason: 'not_implemented', sites: sites || [] })
}

export default async function handler(req, res) {
  if (!checkRateLimit(req, res)) return
  const auth = await authenticateUser(req, res)
  if (!auth) return
  const { profile, supabase } = auth
  const action = req.query.action

  if (action === 'status') return handleStatus(req, res, profile, supabase)
  res.status(404).json({ error: 'Unknown action' })
}
