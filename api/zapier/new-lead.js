// /api/zapier/new-lead.js
// Zapier webhook: receives a new lead and inserts into pipeline_leads table.
//
// Expected POST body: { name, email, company, source, score, notes }
// Authorization: Bearer <ZAPIER_WEBHOOK_SECRET>

import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Validate webhook secret
  const authHeader = req.headers['authorization'] ?? ''
  const token = authHeader.replace('Bearer ', '').trim()
  if (!token || token !== process.env.ZAPIER_WEBHOOK_SECRET) {
    return res.status(401).json({ error: 'Unauthorised' })
  }

  const { name, email, company, source, score = 0, notes } = req.body ?? {}

  if (!name) {
    return res.status(400).json({ error: 'name is required' })
  }

  try {
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    const { data, error } = await supabase
      .from('pipeline_leads')
      .insert({
        name,
        email: email ?? null,
        company: company ?? null,
        source: source ?? null,
        score: parseInt(score, 10) || 0,
        notes: notes ?? null,
        stage: 'captured',
      })
      .select('id')
      .single()

    if (error) {
      console.error('pipeline_leads insert error:', error)
      return res.status(500).json({ error: 'Database error', detail: error.message })
    }

    return res.status(200).json({ success: true, lead_id: data.id })
  } catch (err) {
    console.error('new-lead handler error:', err)
    return res.status(500).json({ error: 'Internal server error', detail: err.message })
  }
}
