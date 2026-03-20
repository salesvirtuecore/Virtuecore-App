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
    const isVA = role === 'va'
    const portalLabel = isVA ? 'VA Portal' : 'Client Portal'
    const signupUrl = `https://virtuecore-app.vercel.app/signup?role=${role}`

    const emailSubject = isVA
      ? `You've been invited to join VirtueCore as a Virtual Assistant`
      : `You've been invited to your VirtueCore Client Portal`

    const emailBody = isVA
      ? `Hi ${full_name || 'there'},\n\nYou've been invited to VirtueCore as a Virtual Assistant. Here's how to get started:\n\n1. Click the link below to create your account and set a password.\n2. Once logged in, you'll land on your Task Board — this is where all your assigned client tasks live.\n3. Use the Time Tracker to log hours against each task as you work.\n4. Check SOPs & Docs for any standard operating procedures or training materials.\n5. Submit your Daily Standup each day to keep the team updated on progress.\n6. If you have any questions, use the Help button inside the app at any time.\n\nClick the link below to get started:\n${signupUrl}\n\nWelcome to the team,\nThe VirtueCore Team`
      : `Hi ${full_name || 'there'},\n\nYou've been invited to your VirtueCore Client Portal. Here's how to get started:\n\n1. Click the link below to create your account and set a password.\n2. Once logged in, you'll land on your Client Dashboard where you can see your campaign overview at a glance.\n3. Check your Deliverables to review and approve work submitted by your team.\n4. Use the Content Calendar to see scheduled content and upcoming posts.\n5. View your Invoices and manage Billing directly from the portal.\n6. Book calls with your team anytime via the Meetings page.\n7. Message your VirtueCore team directly through the Messages section.\n\nClick the link below to get started:\n${signupUrl}\n\nLooking forward to working with you,\nThe VirtueCore Team`

    const n8nPayload = {
      to: email,
      from: 'sales@virtuecore.co.uk',
      subject: emailSubject,
      full_name,
      company_name,
      role,
      portalLabel,
      signupUrl,
      emailBody,
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
