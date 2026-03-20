// Syncs ad performance data from Meta for a client using their stored token.
// Can be called by the client ("Sync Now") or on a schedule.
import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    return res.status(500).json({ error: 'Server not configured' })
  }

  const { client_id } = req.body
  if (!client_id) return res.status(400).json({ error: 'Missing client_id' })

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Load client's stored Meta credentials
  const { data: client, error: clientError } = await supabase
    .from('clients')
    .select('meta_access_token, meta_ad_account_id, meta_token_expires_at')
    .eq('id', client_id)
    .maybeSingle()

  if (clientError || !client) {
    return res.status(404).json({ error: 'Client not found' })
  }
  if (!client.meta_access_token || !client.meta_ad_account_id) {
    return res.status(400).json({ error: 'Meta Ads not connected for this client' })
  }

  // Check token hasn't expired
  if (client.meta_token_expires_at && new Date(client.meta_token_expires_at) < new Date()) {
    return res.status(401).json({ error: 'Meta access token has expired. Please reconnect.' })
  }

  // Fetch from Meta Marketing API
  const fields = [
    'spend', 'impressions', 'clicks', 'leads', 'conversions',
    'ctr', 'cost_per_unique_action_type', 'purchase_roas', 'date_start',
  ].join(',')

  const metaUrl = new URL(`https://graph.facebook.com/v19.0/${client.meta_ad_account_id}/insights`)
  metaUrl.searchParams.set('fields', fields)
  metaUrl.searchParams.set('date_preset', 'last_90d')
  metaUrl.searchParams.set('time_increment', '30')
  metaUrl.searchParams.set('access_token', client.meta_access_token)

  const metaRes = await fetch(metaUrl.toString())
  const metaData = await metaRes.json()

  if (!metaRes.ok) {
    return res.status(502).json({ error: 'Meta API error', detail: metaData })
  }

  const rows = (metaData.data || []).map((row) => {
    const cplEntry = Array.isArray(row.cost_per_unique_action_type)
      ? row.cost_per_unique_action_type.find((a) => a.action_type === 'lead')
      : null
    const roas = Array.isArray(row.purchase_roas)
      ? parseFloat(row.purchase_roas[0]?.value ?? 0)
      : parseFloat(row.purchase_roas ?? 0)

    return {
      client_id,
      platform: 'meta',
      date: row.date_start ?? new Date().toISOString().split('T')[0],
      spend: parseFloat(row.spend ?? 0),
      impressions: parseInt(row.impressions ?? 0, 10),
      clicks: parseInt(row.clicks ?? 0, 10),
      leads: parseInt(row.leads ?? 0, 10),
      conversions: parseInt(row.conversions ?? 0, 10),
      ctr: parseFloat(row.ctr ?? 0),
      cpl: parseFloat(cplEntry?.value ?? 0),
      roas,
    }
  })

  if (rows.length > 0) {
    const { error: upsertError } = await supabase
      .from('ad_performance')
      .upsert(rows, { onConflict: 'client_id,platform,date' })

    if (upsertError) {
      return res.status(500).json({ error: 'Failed to save ad data', detail: upsertError.message })
    }
  }

  res.status(200).json({ ok: true, rows_synced: rows.length })
}
