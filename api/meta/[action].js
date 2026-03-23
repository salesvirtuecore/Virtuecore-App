import { createClient } from '@supabase/supabase-js'

// ── Helpers ────────────────────────────────────────────────────────────────
function makeSupabase() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Server not configured')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

// ── /api/meta/connect (GET) ─────────────────────────────────────────────────
async function handleConnect(req, res) {
  if (req.method !== 'GET') return res.status(405).end()
  const { META_APP_ID, VITE_APP_URL } = process.env
  if (!META_APP_ID || !VITE_APP_URL) return res.status(500).json({ error: 'Meta app not configured' })
  const { client_id } = req.query
  if (!client_id) return res.status(400).json({ error: 'Missing client_id' })
  const redirectUri = `${VITE_APP_URL}/meta/callback`
  const url = new URL('https://www.facebook.com/v19.0/dialog/oauth')
  url.searchParams.set('client_id', META_APP_ID)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('scope', 'ads_read,read_insights')
  url.searchParams.set('state', client_id)
  url.searchParams.set('response_type', 'code')
  res.status(200).json({ url: url.toString() })
}

// ── /api/meta/callback (POST) ───────────────────────────────────────────────
async function handleCallback(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  const { META_APP_ID, META_APP_SECRET, VITE_APP_URL } = process.env
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!META_APP_ID || !META_APP_SECRET || !VITE_APP_URL || !supabaseUrl || !serviceRoleKey) {
    return res.status(500).json({ error: 'Server not configured' })
  }
  const { code, client_id } = req.body
  if (!code || !client_id) return res.status(400).json({ error: 'Missing code or client_id' })
  const redirectUri = `${VITE_APP_URL}/meta/callback`
  const tokenUrl = new URL('https://graph.facebook.com/v19.0/oauth/access_token')
  tokenUrl.searchParams.set('client_id', META_APP_ID)
  tokenUrl.searchParams.set('client_secret', META_APP_SECRET)
  tokenUrl.searchParams.set('redirect_uri', redirectUri)
  tokenUrl.searchParams.set('code', code)
  const tokenRes = await fetch(tokenUrl.toString())
  const tokenData = await tokenRes.json()
  if (!tokenRes.ok || !tokenData.access_token) {
    return res.status(400).json({ error: 'Failed to exchange code', detail: tokenData })
  }
  const longLivedUrl = new URL('https://graph.facebook.com/v19.0/oauth/access_token')
  longLivedUrl.searchParams.set('grant_type', 'fb_exchange_token')
  longLivedUrl.searchParams.set('client_id', META_APP_ID)
  longLivedUrl.searchParams.set('client_secret', META_APP_SECRET)
  longLivedUrl.searchParams.set('fb_exchange_token', tokenData.access_token)
  const longLivedRes = await fetch(longLivedUrl.toString())
  const longLivedData = await longLivedRes.json()
  const accessToken = longLivedData.access_token || tokenData.access_token
  const expiresIn = longLivedData.expires_in || 3600
  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString()
  const accountsUrl = new URL('https://graph.facebook.com/v19.0/me/adaccounts')
  accountsUrl.searchParams.set('fields', 'name,account_id,account_status,currency')
  accountsUrl.searchParams.set('access_token', accessToken)
  const accountsRes = await fetch(accountsUrl.toString())
  const accountsData = await accountsRes.json()
  const accounts = (accountsData.data || []).map((a) => ({
    id: a.id, account_id: a.account_id, name: a.name, status: a.account_status, currency: a.currency,
  }))
  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
  const { error: updateError } = await supabase.from('clients')
    .update({ meta_access_token: accessToken, meta_token_expires_at: expiresAt })
    .eq('id', client_id)
  if (updateError) return res.status(500).json({ error: 'Failed to save token', detail: updateError.message })
  res.status(200).json({ accounts, expires_at: expiresAt })
}

// ── /api/meta/select-account (POST) ────────────────────────────────────────
async function handleSelectAccount(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  const { client_id, ad_account_id } = req.body
  if (!client_id || !ad_account_id) return res.status(400).json({ error: 'Missing client_id or ad_account_id' })
  try {
    const supabase = makeSupabase()
    const { error } = await supabase.from('clients').update({ meta_ad_account_id: ad_account_id }).eq('id', client_id)
    if (error) return res.status(500).json({ error: error.message })
    res.status(200).json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}

// ── /api/meta/sync (POST) ───────────────────────────────────────────────────
async function handleSync(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  const { client_id } = req.body
  if (!client_id) return res.status(400).json({ error: 'Missing client_id' })
  try {
    const supabase = makeSupabase()
    const { data: client, error: clientError } = await supabase.from('clients')
      .select('meta_access_token, meta_ad_account_id, meta_token_expires_at')
      .eq('id', client_id).maybeSingle()
    if (clientError || !client) return res.status(404).json({ error: 'Client not found' })
    if (!client.meta_access_token || !client.meta_ad_account_id) {
      return res.status(400).json({ error: 'Meta Ads not connected for this client' })
    }
    if (client.meta_token_expires_at && new Date(client.meta_token_expires_at) < new Date()) {
      return res.status(401).json({ error: 'Meta access token has expired. Please reconnect.' })
    }
    const fields = ['spend','impressions','clicks','leads','conversions','ctr','cost_per_unique_action_type','purchase_roas','date_start'].join(',')
    const metaUrl = new URL(`https://graph.facebook.com/v19.0/${client.meta_ad_account_id}/insights`)
    metaUrl.searchParams.set('fields', fields)
    metaUrl.searchParams.set('date_preset', 'last_90d')
    metaUrl.searchParams.set('time_increment', '30')
    metaUrl.searchParams.set('access_token', client.meta_access_token)
    const metaRes = await fetch(metaUrl.toString())
    const metaData = await metaRes.json()
    if (!metaRes.ok) return res.status(502).json({ error: 'Meta API error', detail: metaData })
    const rows = (metaData.data || []).map((row) => {
      const cplEntry = Array.isArray(row.cost_per_unique_action_type)
        ? row.cost_per_unique_action_type.find((a) => a.action_type === 'lead') : null
      const roas = Array.isArray(row.purchase_roas) ? parseFloat(row.purchase_roas[0]?.value ?? 0) : parseFloat(row.purchase_roas ?? 0)
      return {
        client_id, platform: 'meta',
        date: row.date_start ?? new Date().toISOString().split('T')[0],
        spend: parseFloat(row.spend ?? 0), impressions: parseInt(row.impressions ?? 0, 10),
        clicks: parseInt(row.clicks ?? 0, 10), leads: parseInt(row.leads ?? 0, 10),
        conversions: parseInt(row.conversions ?? 0, 10), ctr: parseFloat(row.ctr ?? 0),
        cpl: parseFloat(cplEntry?.value ?? 0), roas,
      }
    })
    if (rows.length > 0) {
      const { error: upsertError } = await supabase.from('ad_performance')
        .upsert(rows, { onConflict: 'client_id,platform,date' })
      if (upsertError) return res.status(500).json({ error: 'Failed to save ad data', detail: upsertError.message })
    }
    res.status(200).json({ ok: true, rows_synced: rows.length })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}

// ── Router ─────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  const action = req.query.action
  if (action === 'connect') return handleConnect(req, res)
  if (action === 'callback') return handleCallback(req, res)
  if (action === 'select-account') return handleSelectAccount(req, res)
  if (action === 'sync') return handleSync(req, res)
  res.status(404).json({ error: 'Unknown action' })
}
