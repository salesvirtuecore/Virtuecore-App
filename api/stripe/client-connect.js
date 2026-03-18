import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const stripeSecret = process.env.STRIPE_SECRET_KEY
  const returnUrl =
    process.env.STRIPE_CONNECT_CLIENT_RETURN_URL || 'https://virtuecore-app.vercel.app/client'
  const refreshUrl =
    process.env.STRIPE_CONNECT_CLIENT_REFRESH_URL || 'https://virtuecore-app.vercel.app/client'

  if (!supabaseUrl || !serviceRoleKey || !stripeSecret) {
    return res.status(500).json({ error: 'Server not configured' })
  }

  const authHeader = req.headers.authorization || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) {
    return res.status(401).json({ error: 'Missing auth token' })
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const stripe = new Stripe(stripeSecret, { apiVersion: '2024-04-10' })

  try {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token)

    if (userError || !user) {
      return res.status(401).json({ error: 'Invalid auth token' })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, role, client_id, email')
      .eq('id', user.id)
      .maybeSingle()

    const effectiveRole = profile?.role || user?.user_metadata?.role || null
    if (effectiveRole && effectiveRole !== 'client') {
      return res.status(403).json({ error: 'Only client users can connect Stripe' })
    }

    let client = null
    if (profile.client_id) {
      const { data } = await supabase
        .from('clients')
        .select('id, company_name, contact_email, stripe_account_id')
        .eq('id', profile.client_id)
        .maybeSingle()
      client = data
    }

    // Fallback for legacy users that don't have profile.client_id wired yet.
    if (!client) {
      const { data } = await supabase
        .from('clients')
        .select('id, company_name, contact_email, stripe_account_id')
        .eq('contact_email', user.email)
        .maybeSingle()
      client = data
    }

    if (!client) {
      return res.status(404).json({ error: 'No client record found for this user' })
    }

    let stripeAccountId = client.stripe_account_id

    if (!stripeAccountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        country: 'GB',
        email: client.contact_email || user.email,
        business_type: 'company',
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        metadata: {
          client_id: client.id,
          client_email: client.contact_email || user.email || '',
          company_name: client.company_name || '',
        },
      })

      stripeAccountId = account.id

      const { error: updateError } = await supabase
        .from('clients')
        .update({ stripe_account_id: stripeAccountId })
        .eq('id', client.id)

      if (updateError) throw updateError
    }

    const link = await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: 'account_onboarding',
    })

    return res.status(200).json({
      connectUrl: link.url,
      stripeAccountId,
      clientId: client.id,
    })
  } catch (err) {
    console.error('Client Stripe connect error:', err)
    return res.status(500).json({ error: err.message || 'Stripe connect failed' })
  }
}
