// /api/meta-ads.js
// Fetches Meta Ads campaign data and upserts into Supabase ad_performance table.
// Uses Meta Marketing API v19.0.
//
// Required env vars:
//   META_ADS_ACCESS_TOKEN
//   VITE_SUPABASE_URL  (same as the frontend Supabase URL)
//   SUPABASE_SERVICE_ROLE_KEY
//   ZAPIER_WEBHOOK_SECRET  (used as the shared Authorization token)

import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  // Only allow GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Auth check — Bearer token must match ZAPIER_WEBHOOK_SECRET
  const authHeader = req.headers['authorization'] ?? ''
  const token = authHeader.replace('Bearer ', '').trim()
  if (!token || token !== process.env.ZAPIER_WEBHOOK_SECRET) {
    return res.status(401).json({ error: 'Unauthorised' })
  }

  const { client_id, account_id, date_preset = 'last_30d' } = req.query

  if (!account_id) {
    return res.status(400).json({ error: 'account_id is required' })
  }

  try {
    // ── Fetch from Meta Graph API ──────────────────────────────────────────────
    const fields = [
      'spend',
      'impressions',
      'clicks',
      'leads',
      'conversions',
      'ctr',
      'cost_per_unique_action_type',
      'purchase_roas',
    ].join(',')

    const metaUrl = new URL(
      `https://graph.facebook.com/v19.0/${account_id}/insights`
    )
    metaUrl.searchParams.set('fields', fields)
    metaUrl.searchParams.set('date_preset', date_preset)
    metaUrl.searchParams.set('access_token', process.env.META_ADS_ACCESS_TOKEN)

    const metaResponse = await fetch(metaUrl.toString())
    if (!metaResponse.ok) {
      const errBody = await metaResponse.text()
      return res.status(502).json({ error: 'Meta API error', detail: errBody })
    }

    const metaData = await metaResponse.json()
    const insights = metaData.data ?? []

    // ── Upsert into Supabase ───────────────────────────────────────────────────
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    const rows = insights.map((row) => {
      // cost_per_unique_action_type is an array; find the lead entry
      const cplEntry = Array.isArray(row.cost_per_unique_action_type)
        ? row.cost_per_unique_action_type.find((a) => a.action_type === 'lead')
        : null
      const roas = Array.isArray(row.purchase_roas)
        ? parseFloat(row.purchase_roas[0]?.value ?? 0)
        : parseFloat(row.purchase_roas ?? 0)

      return {
        client_id: client_id ?? null,
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
        console.error('Supabase upsert error:', upsertError)
        // Return data even if upsert fails — don't block the response
      }
    }

    return res.status(200).json({ success: true, rows })
  } catch (err) {
    console.error('meta-ads handler error:', err)
    return res.status(500).json({ error: 'Internal server error', detail: err.message })
  }
}
