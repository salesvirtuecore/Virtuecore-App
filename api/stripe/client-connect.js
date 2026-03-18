import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

function normalizeEmail(email) {
  if (!email || typeof email !== 'string') return null
  const lower = email.trim().toLowerCase()
  const at = lower.indexOf('@')
  if (at === -1) return lower
  const local = lower.slice(0, at)
  const domain = lower.slice(at + 1)
  if ((domain === 'gmail.com' || domain === 'googlemail.com') && local.includes('+')) {
    return `${local.split('+')[0]}@${domain}`
  }
  return lower
}

async function resolveAuthenticatedClient({ supabase, user }) {
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, client_id, email')
    .eq('id', user.id)
    .maybeSingle()

  const effectiveRole = profile?.role || user?.user_metadata?.role || null
  if (effectiveRole && effectiveRole !== 'client') {
    return { error: { status: 403, message: 'Only client users can connect Stripe' } }
  }

  let client = null

  if (profile?.client_id) {
    const { data } = await supabase
      .from('clients')
      .select('id, company_name, contact_email, stripe_account_id')
      .eq('id', profile.client_id)
      .maybeSingle()
    client = data
  }

  if (!client && user.email) {
    const normalizedEmail = normalizeEmail(user.email)
    const emailCandidates = [...new Set([user.email, profile?.email, normalizedEmail].filter(Boolean))]

    for (const candidateEmail of emailCandidates) {
      const { data } = await supabase
        .from('clients')
        .select('id, company_name, contact_email, stripe_account_id')
        .ilike('contact_email', candidateEmail)
        .maybeSingle()

      if (data) {
        client = data
        break
      }
    }
  }

  if (!client && user?.user_metadata?.full_name) {
    const { data } = await supabase
      .from('clients')
      .select('id, company_name, contact_email, stripe_account_id')
      .ilike('contact_name', user.user_metadata.full_name)
      .maybeSingle()
    client = data
  }

  if (!client) {
    const fallbackName =
      user?.user_metadata?.company_name ||
      user?.user_metadata?.full_name ||
      (user.email ? user.email.split('@')[0] : 'Client')

    const { data: createdClient, error: createClientError } = await supabase
      .from('clients')
      .insert({
        company_name: fallbackName,
        contact_name: user?.user_metadata?.full_name || fallbackName,
        contact_email: user.email,
        package_tier: 'Starter',
        status: 'onboarding',
      })
      .select('id, company_name, contact_email, stripe_account_id')
      .single()

    if (createClientError || !createdClient) {
      return {
        error: {
          status: 500,
          message:
            createClientError?.message ||
            'No client record found for this user and auto-create failed',
        },
      }
    }

    client = createdClient
  }

  if (profile?.client_id !== client.id) {
    await supabase
      .from('profiles')
      .update({ client_id: client.id })
      .eq('id', user.id)
  }

  return { client }
}

async function loadStripeAccountStatus({ stripe, stripeAccountId }) {
  if (!stripeAccountId) {
    return {
      connected: false,
      onboardingComplete: false,
      chargesEnabled: false,
      payoutsEnabled: false,
    }
  }

  try {
    const account = await stripe.accounts.retrieve(stripeAccountId)
    return {
      connected: true,
      onboardingComplete: Boolean(account.details_submitted),
      chargesEnabled: Boolean(account.charges_enabled),
      payoutsEnabled: Boolean(account.payouts_enabled),
    }
  } catch (error) {
    console.error('[Stripe Connect] Failed to retrieve Stripe account status:', error)
    return {
      connected: true,
      onboardingComplete: false,
      chargesEnabled: false,
      payoutsEnabled: false,
    }
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const stripeSecret = process.env.STRIPE_SECRET_KEY
  const returnUrl =
    process.env.STRIPE_CONNECT_CLIENT_RETURN_URL || 'https://virtuecore-app.vercel.app/client/billing'
  const refreshUrl =
    process.env.STRIPE_CONNECT_CLIENT_REFRESH_URL || 'https://virtuecore-app.vercel.app/client/billing'

  // Detailed error logging for missing env vars
  if (!supabaseUrl) {
    console.error('[Stripe Connect] Missing VITE_SUPABASE_URL or SUPABASE_URL')
    return res.status(500).json({ error: 'Server not configured: missing Supabase URL' })
  }
  if (!serviceRoleKey) {
    console.error('[Stripe Connect] Missing SUPABASE_SERVICE_ROLE_KEY')
    return res.status(500).json({ error: 'Server not configured: missing Supabase service role key' })
  }
  if (!stripeSecret) {
    console.error('[Stripe Connect] Missing STRIPE_SECRET_KEY')
    return res.status(500).json({ error: 'Server not configured: missing Stripe secret key' })
  }

  console.log('[Stripe Connect] Environment check passed. Initializing Stripe and Supabase...')

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
    console.log('[Stripe Connect] Authenticating user with token...')
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token)

    if (userError) {
      console.error('[Stripe Connect] Auth error:', userError)
      return res.status(401).json({ error: 'Invalid auth token: ' + userError.message })
    }
    if (!user) {
      console.error('[Stripe Connect] No user found for token')
      return res.status(401).json({ error: 'Invalid auth token' })
    }

    console.log('[Stripe Connect] User authenticated:', user.id)

    console.log('[Stripe Connect] Resolving client record...')
    const { client, error: clientError } = await resolveAuthenticatedClient({ supabase, user })

    if (clientError) {
      console.error('[Stripe Connect] Client resolution failed:', clientError.message)
      return res.status(clientError.status).json({ error: clientError.message })
    }

    let stripeAccountId = client?.stripe_account_id || null

    const { data: stripeLookup, error: stripeLookupError } = await supabase
      .from('clients')
      .select('stripe_account_id')
      .eq('id', client.id)
      .maybeSingle()

    if (stripeLookupError) {
      if (stripeLookupError.code === '42703') {
        return res.status(500).json({
          error:
            'Database schema is missing clients.stripe_account_id. Run: alter table clients add column if not exists stripe_account_id text;',
        })
      }
      throw stripeLookupError
    }

    stripeAccountId = stripeLookup?.stripe_account_id || null

    if (req.method === 'GET') {
      const stripeStatus = await loadStripeAccountStatus({ stripe, stripeAccountId })
      return res.status(200).json({
        clientId: client.id,
        companyName: client.company_name || null,
        contactEmail: client.contact_email || user.email || null,
        stripeAccountId,
        ...stripeStatus,
      })
    }

    if (!stripeAccountId) {
      console.log('[Stripe Connect] No account found. Creating new Stripe Express account...')
      try {
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
        console.log('[Stripe Connect] Stripe account created:', stripeAccountId)

        const { error: updateError } = await supabase
          .from('clients')
          .update({ stripe_account_id: stripeAccountId })
          .eq('id', client.id)

        if (updateError) {
          if (updateError.code === '42703') {
            return res.status(500).json({
              error:
                'Database schema is missing clients.stripe_account_id. Run: alter table clients add column if not exists stripe_account_id text;',
            })
          }
          throw updateError
        }
        console.log('[Stripe Connect] Account ID saved to database')
      } catch (stripeErr) {
        console.error('[Stripe Connect] Stripe account creation failed:', stripeErr)
        throw stripeErr
      }
    } else {
      console.log('[Stripe Connect] Existing account found:', stripeAccountId)
    }

    const stripeStatus = await loadStripeAccountStatus({ stripe, stripeAccountId })
    let connectUrl = null

    if (stripeStatus.onboardingComplete) {
      console.log('[Stripe Connect] Creating Express login link for account:', stripeAccountId)
      const loginLink = await stripe.accounts.createLoginLink(stripeAccountId)
      connectUrl = loginLink.url
    } else {
      console.log('[Stripe Connect] Creating account onboarding link for account:', stripeAccountId)
      const onboardingLink = await stripe.accountLinks.create({
        account: stripeAccountId,
        refresh_url: refreshUrl,
        return_url: returnUrl,
        type: 'account_onboarding',
      })
      connectUrl = onboardingLink.url
    }

    console.log('[Stripe Connect] Onboarding link created. Returning to client.')
    return res.status(200).json({
      connectUrl,
      stripeAccountId,
      clientId: client.id,
      companyName: client.company_name || null,
      ...stripeStatus,
    })
  } catch (err) {
    console.error('[Stripe Connect] Fatal error:', err)

    const message = err?.message || 'Stripe connect failed'
    
    // Check for platform profile not completed
    if (message.includes('managing losses for connected accounts')) {
      return res.status(400).json({
        error:
          'Platform setup required: Admin must complete Stripe Connect platform profile at https://dashboard.stripe.com/settings/connect/platform-profile and accept the responsibility agreement, then try again.',
      })
    }

    // Check for Connect not enabled
    if (message.includes('could not be activated') || message.includes('signed up for Connect')) {
      return res.status(400).json({
        error:
          'Stripe Connect is not enabled on this platform account yet. Admin: finish Connect onboarding at https://dashboard.stripe.com/connect/settings, then try again.',
      })
    }

    // Check for Supabase errors
    if (message.includes('PGRST') || message.includes('connection')) {
      return res.status(500).json({
        error: 'Database connection failed. Please try again in a moment.',
      })
    }

    return res.status(500).json({ error: message || 'Stripe connect failed' })
  }
}
