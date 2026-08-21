import { makeSupabase, authenticateUser, requireRole, checkRateLimit } from '../_lib/auth.js'
import { matchAdAccountsToClients } from '../_lib/metaMatching.js'

const INSIGHT_FIELDS = ['campaign_name', 'spend', 'impressions', 'clicks', 'ctr', 'cpc', 'cpm', 'reach', 'frequency', 'actions', 'objective'].join(',')

function systemUserToken() {
  return process.env.META_SYSTEM_USER_TOKEN
}

// ── /api/meta/list-ad-accounts (GET) — admin ────────────────────────────────
// Lists every ad account visible to the shared Business Manager System User
// token — replaces per-client OAuth entirely.
async function handleListAdAccounts(req, res) {
  const token = systemUserToken()
  if (!token) return res.status(500).json({ error: 'META_SYSTEM_USER_TOKEN not configured' })
  const url = new URL('https://graph.facebook.com/v21.0/me/adaccounts')
  url.searchParams.set('fields', 'name,account_id,account_status,business_name')
  url.searchParams.set('access_token', token)
  const metaRes = await fetch(url.toString())
  const metaData = await metaRes.json()
  if (!metaRes.ok) return res.status(502).json({ error: `Meta API error: ${metaData?.error?.message || 'unknown'}`, detail: metaData })
  res.status(200).json({ accounts: metaData.data || [] })
}

// ── /api/meta/match-accounts (POST) — admin ─────────────────────────────────
// Exact normalized-name matches are written directly; everything else lands
// in meta_account_match_queue for a human to confirm or reject.
async function handleMatchAccounts(req, res, supabase) {
  const token = systemUserToken()
  if (!token) return res.status(500).json({ error: 'META_SYSTEM_USER_TOKEN not configured' })

  const url = new URL('https://graph.facebook.com/v21.0/me/adaccounts')
  url.searchParams.set('fields', 'name,account_id,account_status,business_name')
  url.searchParams.set('access_token', token)
  const metaRes = await fetch(url.toString())
  const metaData = await metaRes.json()
  if (!metaRes.ok) return res.status(502).json({ error: `Meta API error: ${metaData?.error?.message || 'unknown'}`, detail: metaData })
  const adAccounts = metaData.data || []

  const { data: clients, error: clientsError } = await supabase.from('clients').select('id, company_name')
  if (clientsError) return res.status(500).json({ error: clientsError.message })

  const { exactMatches, queueRows } = await matchAdAccountsToClients({ adAccounts, clients: clients || [] })

  for (const { account, client } of exactMatches) {
    await supabase.from('clients').update({ meta_ad_account_id: account.account_id }).eq('id', client.id)
  }

  if (queueRows.length > 0) {
    const { data: resolved } = await supabase.from('meta_account_match_queue')
      .select('ad_account_id').in('status', ['confirmed', 'rejected'])
    const resolvedIds = new Set((resolved || []).map((r) => r.ad_account_id))
    const rowsToUpsert = queueRows.filter((r) => !resolvedIds.has(r.ad_account_id))
    if (rowsToUpsert.length > 0) {
      await supabase.from('meta_account_match_queue').upsert(rowsToUpsert, { onConflict: 'ad_account_id' })
    }
  }

  res.status(200).json({ ok: true, exact_matches: exactMatches.length, queued: queueRows.length })
}

// ── /api/meta/confirm-match (POST) — admin ──────────────────────────────────
async function handleConfirmMatch(req, res, supabase, profile) {
  const { queue_id, client_id } = req.body ?? {}
  if (!queue_id || !client_id) return res.status(400).json({ error: 'queue_id and client_id required' })
  const { data: row, error: rowError } = await supabase.from('meta_account_match_queue').select('ad_account_id').eq('id', queue_id).maybeSingle()
  if (rowError || !row) return res.status(404).json({ error: 'Queue entry not found' })

  const { error: clientError } = await supabase.from('clients').update({ meta_ad_account_id: row.ad_account_id }).eq('id', client_id)
  if (clientError) return res.status(500).json({ error: clientError.message })

  await supabase.from('meta_account_match_queue').update({
    status: 'confirmed', resolved_by: profile.id, resolved_at: new Date().toISOString(),
  }).eq('id', queue_id)
  res.status(200).json({ ok: true })
}

// ── /api/meta/reject-match (POST) — admin ───────────────────────────────────
async function handleRejectMatch(req, res, supabase, profile) {
  const { queue_id } = req.body ?? {}
  if (!queue_id) return res.status(400).json({ error: 'queue_id required' })
  const { error } = await supabase.from('meta_account_match_queue').update({
    status: 'rejected', resolved_by: profile.id, resolved_at: new Date().toISOString(),
  }).eq('id', queue_id)
  if (error) return res.status(500).json({ error: error.message })
  res.status(200).json({ ok: true })
}

// ── /api/meta/list-queue (GET) — admin ──────────────────────────────────────
async function handleListQueue(req, res, supabase) {
  const { data, error } = await supabase.from('meta_account_match_queue')
    .select('*').eq('status', 'pending').order('created_at', { ascending: false })
  if (error) return res.status(500).json({ error: error.message })
  res.status(200).json({ queue: data || [] })
}

// ── /api/meta/sync-client-insights (POST) — admin, or CRON_SECRET ──────────
// client_id: a specific client's id, or 'all' to sync every matched client.
async function handleSyncClientInsights(req, res, supabase) {
  const token = systemUserToken()
  if (!token) return res.status(500).json({ error: 'META_SYSTEM_USER_TOKEN not configured' })
  // Vercel's cron invocation is a bare GET with no body — default to syncing everyone.
  const client_id = req.body?.client_id || 'all'

  let targets
  if (client_id === 'all') {
    const { data } = await supabase.from('clients').select('id, meta_ad_account_id').not('meta_ad_account_id', 'is', null)
    targets = data || []
  } else {
    const { data } = await supabase.from('clients').select('id, meta_ad_account_id').eq('id', client_id).maybeSingle()
    if (!data?.meta_ad_account_id) return res.status(400).json({ error: 'This client has no matched ad account' })
    targets = [data]
  }

  let totalRowsSynced = 0
  const errors = []
  for (const client of targets) {
    try {
      const url = new URL(`https://graph.facebook.com/v21.0/${client.meta_ad_account_id}/insights`)
      url.searchParams.set('fields', INSIGHT_FIELDS)
      url.searchParams.set('level', 'account')
      url.searchParams.set('date_preset', 'last_30d')
      url.searchParams.set('time_increment', '1')
      url.searchParams.set('access_token', token)
      const metaRes = await fetch(url.toString())
      const metaData = await metaRes.json()
      if (!metaRes.ok) { errors.push({ client_id: client.id, error: metaData?.error?.message }); continue }

      const rows = (metaData.data || []).map((row) => {
        const actions = Array.isArray(row.actions) ? row.actions : []
        const leadAction = actions.find((a) => a.action_type === 'lead' || a.action_type === 'onsite_conversion.lead_grouped')
        const spend = parseFloat(row.spend ?? 0)
        const leads = parseInt(leadAction?.value ?? 0, 10)
        return {
          client_id: client.id, platform: 'meta',
          date: row.date_start ?? new Date().toISOString().split('T')[0],
          spend, impressions: parseInt(row.impressions ?? 0, 10), clicks: parseInt(row.clicks ?? 0, 10),
          leads, conversions: leads,
          ctr: parseFloat(row.ctr ?? 0), cpl: leads > 0 ? spend / leads : 0, roas: 0,
        }
      })
      if (rows.length > 0) {
        const { error: upsertError } = await supabase.from('ad_performance').upsert(rows, { onConflict: 'client_id,platform,date' })
        if (upsertError) { errors.push({ client_id: client.id, error: upsertError.message }); continue }
        totalRowsSynced += rows.length
      }
    } catch (err) {
      errors.push({ client_id: client.id, error: err.message })
    }
  }

  res.status(200).json({ ok: true, clients_synced: targets.length - errors.length, rows_synced: totalRowsSynced, errors })
}

// ── Router ─────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (!checkRateLimit(req, res)) return

  const action = req.query.action

  // The daily cron hits sync-client-insights as a bare GET with CRON_SECRET as
  // a Bearer token (Vercel's cron convention) instead of a user session.
  if (action === 'sync-client-insights') {
    const authHeader = (req.headers.authorization || '').replace('Bearer ', '').trim()
    const cronSecret = req.headers['x-cron-secret'] || authHeader
    if (cronSecret && cronSecret === process.env.CRON_SECRET) {
      return handleSyncClientInsights(req, res, makeSupabase())
    }
  }

  const auth = await authenticateUser(req, res)
  if (!auth) return
  if (!requireRole(res, auth.profile, 'admin')) return
  const { profile, supabase } = auth

  if (action === 'list-ad-accounts') return handleListAdAccounts(req, res)
  if (action === 'match-accounts') return handleMatchAccounts(req, res, supabase)
  if (action === 'list-queue') return handleListQueue(req, res, supabase)
  if (action === 'confirm-match') return handleConfirmMatch(req, res, supabase, profile)
  if (action === 'reject-match') return handleRejectMatch(req, res, supabase, profile)
  if (action === 'sync-client-insights') return handleSyncClientInsights(req, res, supabase)
  res.status(404).json({ error: 'Unknown action' })
}
