// /api/zapier/task-update.js
// Zapier webhook: updates a task's status.
//
// Expected POST body: { task_id, status, notes }
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

  const { task_id, status, notes } = req.body ?? {}

  if (!task_id || !status) {
    return res.status(400).json({ error: 'task_id and status are required' })
  }

  const VALID_STATUSES = ['not_started', 'in_progress', 'complete']
  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` })
  }

  try {
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    const updatePayload = {
      status,
      ...(notes ? { brief: notes } : {}),
      ...(status === 'complete' ? { completed_at: new Date().toISOString() } : {}),
    }

    const { error } = await supabase
      .from('tasks')
      .update(updatePayload)
      .eq('id', task_id)

    if (error) {
      console.error('tasks update error:', error)
      return res.status(500).json({ error: 'Database error', detail: error.message })
    }

    return res.status(200).json({ success: true })
  } catch (err) {
    console.error('task-update handler error:', err)
    return res.status(500).json({ error: 'Internal server error', detail: err.message })
  }
}
