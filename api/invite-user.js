import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const resendKey = process.env.RESEND_API_KEY

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

    // Step 1: Create client record first (for client role)
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

    // Step 2: Create the user (email confirmed, no password yet)
    const { data: userData, error: createError } = await supabase.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { full_name, role, client_id },
    })

    if (createError) throw createError
    const userId = userData.user.id

    // Step 3: Insert profile
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({
        id: userId,
        email,
        full_name: full_name || '',
        role,
        client_id: client_id || null,
      }, { onConflict: 'id' })

    if (profileError) {
      console.error('Profile upsert error (non-fatal):', profileError)
    }

    // Step 4: Generate a password reset link (this is how the user sets their password)
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: {
        redirectTo: 'https://virtuecore-app.vercel.app/accept-invite',
      },
    })

    if (linkError) throw linkError
    const inviteLink = linkData.properties.action_link

    // Step 5: Send email via Resend directly
    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'VirtueCore <noreply@virtuecore.co.uk>',
        to: [email],
        subject: `You've been invited to VirtueCore`,
        html: `
          <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
            <h1 style="font-size: 24px; font-weight: 600; color: #1A1A1A; margin-bottom: 8px;">Welcome to VirtueCore</h1>
            <p style="color: #666666; font-size: 15px; margin-bottom: 24px;">
              Hi ${full_name || 'there'},<br/><br/>
              You've been invited to access the VirtueCore client portal. Click the button below to set your password and get started.
            </p>
            <a href="${inviteLink}" style="display: inline-block; background: #D4A843; color: white; text-decoration: none; padding: 12px 24px; border-radius: 4px; font-size: 14px; font-weight: 500;">
              Accept Invite & Set Password
            </a>
            <p style="color: #999999; font-size: 13px; margin-top: 24px;">
              This link expires in 24 hours. If you didn't expect this invite, you can ignore this email.
            </p>
            <hr style="border: none; border-top: 1px solid #E5E5E5; margin: 24px 0;" />
            <p style="color: #999999; font-size: 12px;">VirtueCore · virtuecore.co.uk</p>
          </div>
        `,
      }),
    })

    if (!emailRes.ok) {
      const emailErr = await emailRes.json()
      throw new Error(`Email send failed: ${emailErr.message}`)
    }

    return res.status(200).json({ success: true, message: 'Invite sent successfully' })
  } catch (error) {
    console.error('Invite error:', error)
    return res.status(500).json({ error: error.message })
  }
}
