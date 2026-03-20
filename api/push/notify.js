import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { VAPID_SUBJECT, VITE_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY } = process.env
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!VAPID_SUBJECT || !VITE_VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !supabaseUrl || !serviceRoleKey) {
    return res.status(500).json({ error: 'Server not configured' })
  }

  webpush.setVapidDetails(VAPID_SUBJECT, VITE_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)

  const { user_id, title, body, url } = req.body
  if (!user_id) return res.status(400).json({ error: 'Missing user_id' })

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('*')
    .eq('user_id', user_id)

  if (!subs?.length) return res.status(200).json({ ok: true, sent: 0 })

  const payload = JSON.stringify({ title: title ?? 'VirtueCore', body: body ?? '', url: url ?? '/' })

  const results = await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        )
      } catch (err) {
        // Remove stale subscriptions
        if (err.statusCode === 410 || err.statusCode === 404) {
          await supabase.from('push_subscriptions').delete().eq('id', sub.id)
        }
        throw err
      }
    })
  )

  const sent = results.filter((r) => r.status === 'fulfilled').length
  res.status(200).json({ ok: true, sent })
}
