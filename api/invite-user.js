import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    return res.status(500).json({ error: 'Server not configured' })
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  })

  const { email, full_name, role, company_name, package_tier, monthly_retainer, revenue_share_percentage } = req.body

  if (!email || !role) {
    return res.status(400).json({ error: 'Email and role are required' })
  }

  try {
    let client_id = null

    if (role === 'client') {
      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .insert({
          company_name: company_name || full_name,
          contact_name: full_name,
          contact_email: email,
          package_tier: package_tier || 'Starter',
          monthly_retainer: monthly_retainer || 0,
          revenue_share_percentage: revenue_share_percentage || 0,
          status: 'onboarding',
        })
        .select('id')
        .single()

      if (clientError) throw clientError
      client_id = clientData.id
    }

    const inviteData = { full_name, role }
    if (client_id) inviteData.client_id = client_id

    const { error: inviteError } = await supabase.auth.admin.inviteUserByEmail(email, {
      data: inviteData,
      redirectTo: `${process.env.VITE_APP_URL || 'https://virtuecore-app.vercel.app'}/login`,
    })

    if (inviteError) throw inviteError

    return res.status(200).json({ success: true, message: 'Invite sent successfully' })
  } catch (error) {
    console.error('Invite error:', error)
    return res.status(500).json({ error: error.message })
  }
}
