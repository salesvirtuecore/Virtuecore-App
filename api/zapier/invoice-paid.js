// /api/zapier/invoice-paid.js
// Zapier webhook: marks an invoice as paid.
//
// Expected POST body: { invoice_id, amount, paid_date }
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

  const { invoice_id, amount, paid_date } = req.body ?? {}

  if (!invoice_id) {
    return res.status(400).json({ error: 'invoice_id is required' })
  }

  try {
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    const { error } = await supabase
      .from('invoices')
      .update({
        status: 'paid',
        paid_date: paid_date ?? new Date().toISOString().split('T')[0],
        ...(amount ? { amount: parseFloat(amount) } : {}),
      })
      .eq('id', invoice_id)

    if (error) {
      console.error('invoices update error:', error)
      return res.status(500).json({ error: 'Database error', detail: error.message })
    }

    return res.status(200).json({ success: true })
  } catch (err) {
    console.error('invoice-paid handler error:', err)
    return res.status(500).json({ error: 'Internal server error', detail: err.message })
  }
}
