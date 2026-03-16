// /api/zapier/ad-alert.js
// Zapier webhook: inserts a system message/alert into the messages table.
//
// Expected POST body: { client_id, platform, metric, value, message }
// Authorization: Bearer <ZAPIER_WEBHOOK_SECRET>

import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const authHeader = req.headers['authorization'] ?? ''
  const token = authHeader.replace('Bearer ', '').trim()
  if (!token || token !== process.env.ZAPIER_WEBHOOK_SECRET) {
    return res.status(401).json({ error: 'Unauthorised' })
  }

  const { client_id, platform, metric, value, message } = req.body ?? {}

  if (!client_id || !message) {
    return res.status(400).json({ error: 'client_id and message are required' })
  }

  try {
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    const alertContent = platform && metric && value
      ? `[${platform.toUpperCase()} ALERT] ${metric}: ${value}. ${message}`
      : `[SYSTEM ALERT] ${message}`

    const { error } = await supabase.from('messages').insert({
      client_id,
      sender_id: null, // system message — no sender profile
      content: alertContent,
    })

    if (error) {
      console.error('messages insert error:', error)
      return res.status(500).json({ error: 'Database error', detail: error.message })
    }

    return res.status(200).json({ success: true })
  } catch (err) {
    console.error('ad-alert handler error:', err)
    return res.status(500).json({ error: 'Internal server error', detail: err.message })
  }
}
