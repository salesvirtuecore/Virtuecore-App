import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'

function makeSupabase() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Server not configured')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

// ── /api/push/notify (POST) ─────────────────────────────────────────────────
async function handleNotify(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  const { VAPID_SUBJECT, VITE_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY } = process.env
  if (!VAPID_SUBJECT || !VITE_VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return res.status(500).json({ error: 'Server not configured' })
  }
  webpush.setVapidDetails(VAPID_SUBJECT, VITE_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
  const { user_id, title, body, url } = req.body
  if (!user_id) return res.status(400).json({ error: 'Missing user_id' })
  try {
    const supabase = makeSupabase()
    const { data: subs } = await supabase.from('push_subscriptions').select('*').eq('user_id', user_id)
    if (!subs?.length) return res.status(200).json({ ok: true, sent: 0 })
    const payload = JSON.stringify({ title: title ?? 'VirtueCore', body: body ?? '', url: url ?? '/' })
    const results = await Promise.allSettled(subs.map(async (sub) => {
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload)
      } catch (err) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          await supabase.from('push_subscriptions').delete().eq('id', sub.id)
        }
        throw err
      }
    }))
    const sent = results.filter((r) => r.status === 'fulfilled').length
    res.status(200).json({ ok: true, sent })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}

// ── /api/push/subscribe (POST) ──────────────────────────────────────────────
async function handleSubscribe(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  const { user_id, subscription } = req.body
  if (!user_id || !subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
    return res.status(400).json({ error: 'Missing fields' })
  }
  try {
    const supabase = makeSupabase()
    const { error } = await supabase.from('push_subscriptions').upsert(
      { user_id, endpoint: subscription.endpoint, p256dh: subscription.keys.p256dh, auth: subscription.keys.auth },
      { onConflict: 'user_id,endpoint' }
    )
    if (error) return res.status(500).json({ error: error.message })
    res.status(200).json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}

// ── Router ─────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  const action = req.query.action
  if (action === 'notify') return handleNotify(req, res)
  if (action === 'subscribe') return handleSubscribe(req, res)
  res.status(404).json({ error: 'Unknown action' })
}
