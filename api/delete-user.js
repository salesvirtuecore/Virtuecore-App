import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) return res.status(500).json({ error: 'Server not configured' })

  const { email } = req.body
  if (!email) return res.status(400).json({ error: 'Email required' })

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Find user by email
  const { data: { users }, error: listError } = await supabase.auth.admin.listUsers()
  if (listError) return res.status(500).json({ error: listError.message })

  const user = users.find((u) => u.email?.toLowerCase() === email.toLowerCase())
  if (!user) return res.status(404).json({ error: 'User not found' })

  // Delete from auth
  const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id)
  if (deleteError) return res.status(500).json({ error: deleteError.message })

  // Also clean up profiles row if it exists
  await supabase.from('profiles').delete().eq('id', user.id)

  return res.status(200).json({ success: true, deleted: email })
}
