// Saves the client's chosen Meta Ad Account ID to their record.
// Also triggers an initial ad data sync.
import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    return res.status(500).json({ error: 'Server not configured' })
  }

  const { client_id, ad_account_id } = req.body
  if (!client_id || !ad_account_id) {
    return res.status(400).json({ error: 'Missing client_id or ad_account_id' })
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { error } = await supabase
    .from('clients')
    .update({ meta_ad_account_id: ad_account_id })
    .eq('id', client_id)

  if (error) return res.status(500).json({ error: error.message })

  res.status(200).json({ ok: true })
}
