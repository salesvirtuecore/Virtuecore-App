import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const resendKey = process.env.RESEND_API_KEY

  if (!supabaseUrl || !serviceRoleKey || !resendKey) {
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
        })

      if (clientError) throw clientError
    }

    // Step 2: Send invite email via Resend with signup link
    const signupUrl = 'https://virtuecore-app.vercel.app/signup'
    const portalLabel = role === 'va' ? 'VA portal' : 'client portal'

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
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px; color: #1A1A1A;">
            <h1 style="font-size: 22px; font-weight: 600; margin-bottom: 8px;">Welcome to VirtueCore</h1>
            <p style="color: #666666; font-size: 15px; line-height: 1.6; margin-bottom: 24px;">
              Hi ${full_name || 'there'},<br/><br/>
              You've been given access to your VirtueCore ${portalLabel}. Click the button below to create your account and get started.
            </p>
            <a href="${signupUrl}" style="display: inline-block; background-color: #D4A843; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 4px; font-size: 14px; font-weight: 500; margin-bottom: 24px;">
              Create your account →
            </a>
            <p style="color: #999999; font-size: 13px; margin-top: 8px;">
              Or copy this link: ${signupUrl}
            </p>
            <hr style="border: none; border-top: 1px solid #E5E5E5; margin: 28px 0;" />
            <p style="color: #999999; font-size: 12px; margin: 0;">VirtueCore · virtuecore.co.uk</p>
          </div>
        `,
      }),
    })

    if (!emailRes.ok) {
      const emailErr = await emailRes.json()
      throw new Error(`Email failed: ${emailErr.message}`)
    }

    return res.status(200).json({ success: true, message: 'Invite sent successfully' })
  } catch (error) {
    console.error('Invite error:', error)
    return res.status(500).json({ error: error.message })
  }
}
