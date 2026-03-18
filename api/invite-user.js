import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL || 'https://virtualcore.app.n8n.cloud/webhook/virtuecore-invite'

  if (!supabaseUrl || !serviceRoleKey || !n8nWebhookUrl) {
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
    // Step 1: Create client record in database (for client role)
    if (role === 'client') {
      const { error: clientError } = await supabase
        .from('clients')
        .insert({
          company_name: company_name || full_name,
          contact_name: full_name,
          contact_email: email,
          package_tier: package_tier || 'Starter',
          monthly_retainer: monthly_retainer || 0,
          revenue_share_percentage: revenue_share_percentage || 0,
          status: 'onboarding',
          onboarding_started_at: new Date().toISOString(),
        })

      if (clientError) throw clientError
    }

    // Step 2: Send invite via n8n workflow (supabase resource already updated)
    const portalLabel = role === 'va' ? 'VA portal' : 'client portal'
    const n8nPayload = {
      to: email,
      from: 'sales@virtuecore.co.uk',
      subject: `You've been invited to VirtueCore`,
      full_name,
      company_name,
      role,
      portalLabel,
      signupUrl: 'https://virtuecore-app.vercel.app/signup',
    }

    const n8nRes = await fetch(n8nWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(n8nPayload),
    })

    if (!n8nRes.ok) {
      const n8nBody = await n8nRes.text()
      throw new Error(`n8n workflow invocation failed: ${n8nRes.status} ${n8nBody}`)
    }

    return res.status(200).json({ success: true, message: 'Invite flow triggered via n8n' })
  } catch (error) {
    console.error('Invite error:', error)
    return res.status(500).json({ error: error.message })
  }
}
