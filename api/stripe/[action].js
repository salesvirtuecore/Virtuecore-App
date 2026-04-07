import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { authenticateUser, requireRole, checkRateLimit } from '../_lib/auth.js'

// ── Shared helpers ──────────────────────────────────────────────────────────
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
  const { data: profile } = await supabase.from('profiles')
    .select('id, role, client_id, email').eq('id', user.id).maybeSingle()
  const effectiveRole = profile?.role || user?.user_metadata?.role || null
  if (effectiveRole && effectiveRole !== 'client') {
    return { error: { status: 403, message: 'Only client users can connect Stripe' } }
  }
  let client = null
  if (profile?.client_id) {
    const { data } = await supabase.from('clients')
      .select('id, company_name, contact_email, stripe_account_id').eq('id', profile.client_id).maybeSingle()
    client = data
  }
  if (!client && user.email) {
    const normalizedEmail = normalizeEmail(user.email)
    const candidates = [...new Set([user.email, profile?.email, normalizedEmail].filter(Boolean))]
    for (const email of candidates) {
      const { data } = await supabase.from('clients')
        .select('id, company_name, contact_email, stripe_account_id').ilike('contact_email', email).maybeSingle()
      if (data) { client = data; break }
    }
  }
  if (!client && user?.user_metadata?.full_name) {
    const { data } = await supabase.from('clients')
      .select('id, company_name, contact_email, stripe_account_id').ilike('contact_name', user.user_metadata.full_name).maybeSingle()
    client = data
  }
  if (!client) {
    const fallbackName = user?.user_metadata?.company_name || user?.user_metadata?.full_name || (user.email ? user.email.split('@')[0] : 'Client')
    const { data: createdClient, error: createClientError } = await supabase.from('clients').insert({
      company_name: fallbackName, contact_name: user?.user_metadata?.full_name || fallbackName,
      contact_email: user.email, package_tier: 'Starter', status: 'onboarding',
    }).select('id, company_name, contact_email, stripe_account_id').single()
    if (createClientError || !createdClient) {
      return { error: { status: 500, message: createClientError?.message || 'No client record found and auto-create failed' } }
    }
    client = createdClient
  }
  if (profile?.client_id !== client.id) {
    await supabase.from('profiles').update({ client_id: client.id }).eq('id', user.id)
  }
  return { client }
}

async function loadStripeAccountStatus({ stripe, stripeAccountId }) {
  if (!stripeAccountId) return { connected: false, onboardingComplete: false, chargesEnabled: false, payoutsEnabled: false }
  try {
    const account = await stripe.accounts.retrieve(stripeAccountId)
    return { connected: true, onboardingComplete: Boolean(account.details_submitted), chargesEnabled: Boolean(account.charges_enabled), payoutsEnabled: Boolean(account.payouts_enabled) }
  } catch {
    return { connected: true, onboardingComplete: false, chargesEnabled: false, payoutsEnabled: false }
  }
}

// ── /api/stripe/client-connect (GET or POST) ────────────────────────────────
// GET  → returns connection status + revenue totals
// POST → returns Stripe Standard OAuth URL for the client to authorise
async function handleClientConnect(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const stripeSecret = process.env.STRIPE_SECRET_KEY
  const stripeClientId = process.env.STRIPE_CLIENT_ID
  if (!supabaseUrl) return res.status(500).json({ error: 'Server not configured: missing Supabase URL' })
  if (!serviceRoleKey) return res.status(500).json({ error: 'Server not configured: missing Supabase service role key' })
  if (!stripeSecret) return res.status(500).json({ error: 'Server not configured: missing Stripe secret key' })

  const token = (req.headers.authorization || '').replace('Bearer ', '') || null
  if (!token) return res.status(401).json({ error: 'Missing auth token' })
  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
  const stripe = new Stripe(stripeSecret, { apiVersion: '2024-04-10', httpClient: Stripe.createFetchHttpClient() })

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    if (userError || !user) return res.status(401).json({ error: userError?.message || 'Invalid auth token' })
    const { client, error: clientError } = await resolveAuthenticatedClient({ supabase, user })
    if (clientError) return res.status(clientError.status).json({ error: clientError.message })

    // Fetch revenue totals for this client
    const { data: clientFull } = await supabase.from('clients')
      .select('id, company_name, contact_email, stripe_account_id, stripe_connected_at, stripe_total_revenue, stripe_revenue_synced_at')
      .eq('id', client.id).maybeSingle()
    const stripeAccountId = clientFull?.stripe_account_id || null

    if (req.method === 'GET') {
      const stripeStatus = await loadStripeAccountStatus({ stripe, stripeAccountId })
      return res.status(200).json({
        clientId: clientFull.id,
        companyName: clientFull.company_name || null,
        contactEmail: clientFull.contact_email || user.email || null,
        stripeAccountId,
        connectedAt: clientFull.stripe_connected_at,
        totalRevenue: Number(clientFull.stripe_total_revenue || 0),
        revenueSyncedAt: clientFull.stripe_revenue_synced_at,
        ...stripeStatus,
      })
    }

    // POST → return Stripe Standard OAuth URL
    if (!stripeClientId) return res.status(500).json({ error: 'STRIPE_CLIENT_ID not configured in environment' })
    const appUrl = process.env.VITE_APP_URL || 'https://app.virtuecore.co.uk'
    const redirectUri = `${appUrl}/api/stripe/oauth-callback`
    const oauthUrl = new URL('https://connect.stripe.com/oauth/authorize')
    oauthUrl.searchParams.set('response_type', 'code')
    oauthUrl.searchParams.set('client_id', stripeClientId)
    oauthUrl.searchParams.set('scope', 'read_only')
    oauthUrl.searchParams.set('redirect_uri', redirectUri)
    oauthUrl.searchParams.set('state', token)
    oauthUrl.searchParams.set('stripe_user[email]', clientFull.contact_email || user.email || '')
    oauthUrl.searchParams.set('stripe_user[business_name]', clientFull.company_name || '')
    return res.status(200).json({ connectUrl: oauthUrl.toString(), stripeAccountId, clientId: clientFull.id })
  } catch (err) {
    return res.status(500).json({ error: err?.message || 'Stripe connect failed' })
  }
}

// ── /api/stripe/oauth-callback (GET) ────────────────────────────────────────
// Stripe redirects the user here after OAuth authorisation.
// Exchanges the code for the connected account ID and stores it.
async function handleOAuthCallback(req, res) {
  if (req.method !== 'GET') return res.status(405).end()
  const appUrl = process.env.VITE_APP_URL || 'https://app.virtuecore.co.uk'
  const { code, state, error: stripeError, error_description } = req.query

  function redirectWithError(msg) {
    res.writeHead(302, { Location: `${appUrl}/client/billing?error=${encodeURIComponent(msg)}` })
    res.end()
  }

  if (stripeError) return redirectWithError(error_description || stripeError)
  if (!code || !state) return redirectWithError('Missing code or state')

  try {
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )
    const { data: { user }, error: userError } = await supabase.auth.getUser(state)
    if (userError || !user) return redirectWithError('Session expired — please try again')

    const { data: profile } = await supabase.from('profiles')
      .select('client_id, role').eq('id', user.id).maybeSingle()
    if (!profile?.client_id) return redirectWithError('No client record found')

    // Exchange the code for an access token + connected account ID
    const tokenRes = await fetch('https://connect.stripe.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_secret: process.env.STRIPE_SECRET_KEY,
        code,
        grant_type: 'authorization_code',
      }),
    })
    const tokenData = await tokenRes.json()
    if (!tokenRes.ok || !tokenData.stripe_user_id) {
      return redirectWithError(tokenData.error_description || 'Stripe token exchange failed')
    }

    await supabase.from('clients').update({
      stripe_account_id: tokenData.stripe_user_id,
      stripe_connected_at: new Date().toISOString(),
    }).eq('id', profile.client_id)

    res.writeHead(302, { Location: `${appUrl}/client/billing?connected=true` })
    res.end()
  } catch (err) {
    return redirectWithError(err?.message || 'Unexpected error')
  }
}

// ── /api/stripe/sync-revenue (POST) ─────────────────────────────────────────
// Fetches all successful charges from the client's connected Stripe account
// since their VirtueCore join date, then stores the total.
async function handleSyncRevenue(req, res, authProfile) {
  if (req.method !== 'POST') return res.status(405).end()
  const stripeSecret = process.env.STRIPE_SECRET_KEY
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!stripeSecret) return res.status(500).json({ error: 'Stripe not configured' })

  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
  const stripe = new Stripe(stripeSecret, { apiVersion: '2024-04-10', httpClient: Stripe.createFetchHttpClient() })

  // Determine which client to sync (admin can sync anyone, client can only sync own)
  let clientId
  if (authProfile.role === 'admin') {
    clientId = req.body?.client_id
    if (!clientId) return res.status(400).json({ error: 'client_id required' })
  } else if (authProfile.role === 'client') {
    clientId = authProfile.client_id
    if (!clientId) return res.status(400).json({ error: 'No client linked to your account' })
  } else {
    return res.status(403).json({ error: 'Forbidden' })
  }

  const { data: client } = await supabase.from('clients')
    .select('id, stripe_account_id, onboarding_started_at, created_at')
    .eq('id', clientId).maybeSingle()
  if (!client) return res.status(404).json({ error: 'Client not found' })
  if (!client.stripe_account_id) return res.status(400).json({ error: 'Stripe not connected — please connect your Stripe account first' })

  // "Since joining VirtueCore"
  const joinDate = client.onboarding_started_at || client.created_at
  const joinUnix = Math.floor(new Date(joinDate).getTime() / 1000)

  try {
    let totalRevenue = 0
    let chargeCount = 0
    let hasMore = true
    let startingAfter

    while (hasMore) {
      const params = { created: { gte: joinUnix }, limit: 100 }
      if (startingAfter) params.starting_after = startingAfter
      const charges = await stripe.charges.list(params, { stripeAccount: client.stripe_account_id })

      for (const charge of charges.data) {
        if (charge.status === 'succeeded') {
          const net = (charge.amount - (charge.amount_refunded || 0)) / 100
          totalRevenue += net
          chargeCount++
        }
      }

      hasMore = charges.has_more
      startingAfter = charges.data.length > 0 ? charges.data[charges.data.length - 1].id : undefined
    }

    await supabase.from('clients').update({
      stripe_total_revenue: totalRevenue,
      stripe_revenue_synced_at: new Date().toISOString(),
    }).eq('id', clientId)

    return res.status(200).json({
      ok: true,
      total_revenue: totalRevenue,
      charge_count: chargeCount,
      since: joinDate,
    })
  } catch (err) {
    return res.status(500).json({ error: err?.message || 'Sync failed' })
  }
}

// ── /api/stripe/connect (POST) ──────────────────────────────────────────────
async function handleConnect(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const stripeSecret = process.env.STRIPE_SECRET_KEY
  const returnUrl = process.env.STRIPE_CONNECT_RETURN_URL || 'https://app.virtuecore.co.uk/admin/clients'
  const refreshUrl = process.env.STRIPE_CONNECT_REFRESH_URL || 'https://app.virtuecore.co.uk/admin/clients'
  if (!supabaseUrl || !serviceRoleKey || !stripeSecret) {
    return res.status(500).json({ error: 'Server not configured' })
  }
  const { client_id, contact_email } = req.body
  if (!client_id || !contact_email) return res.status(400).json({ error: 'client_id and contact_email are required' })
  const stripe = new Stripe(stripeSecret, { apiVersion: '2024-04-10', httpClient: Stripe.createFetchHttpClient() })
  const supabase = createClient(supabaseUrl, serviceRoleKey)
  try {
    const account = await stripe.accounts.create({
      type: 'express', country: 'GB', email: contact_email,
      capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
    })
    if (!account?.id) throw new Error('Failed to create Stripe account')
    const { error: updateError } = await supabase.from('clients').update({ stripe_account_id: account.id }).eq('id', client_id)
    if (updateError) throw updateError
    const link = await stripe.accountLinks.create({ account: account.id, refresh_url: refreshUrl, return_url: returnUrl, type: 'account_onboarding' })
    return res.status(200).json({ connectUrl: link.url, stripeAccountId: account.id })
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Stripe connect failed' })
  }
}

// ── /api/stripe/create-checkout (POST) ─────────────────────────────────────
async function handleCreateCheckout(req, res, authProfile) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const { invoice_id } = req.body ?? {}
  if (!invoice_id) return res.status(400).json({ error: 'invoice_id is required' })
  const stripeSecret = process.env.STRIPE_SECRET_KEY
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const appUrl = process.env.APP_URL || process.env.VITE_APP_URL || 'https://app.virtuecore.co.uk'
  if (!stripeSecret || !supabaseUrl || !serviceRoleKey) return res.status(500).json({ error: 'Server not configured' })
  const stripe = new Stripe(stripeSecret, { apiVersion: '2024-04-10', httpClient: Stripe.createFetchHttpClient() })
  const supabase = createClient(supabaseUrl, serviceRoleKey)
  try {
    const { data: invoice, error } = await supabase.from('invoices')
      .select('*, clients(contact_email, company_name)').eq('id', invoice_id).single()
    if (error || !invoice) return res.status(404).json({ error: 'Invoice not found' })
    if (invoice.status === 'paid') return res.status(400).json({ error: 'Invoice already paid' })

    // Ownership check: clients can only pay their own invoices, admins can pay any
    if (authProfile.role !== 'admin' && authProfile.client_id !== invoice.client_id) {
      return res.status(403).json({ error: 'You do not have permission to pay this invoice' })
    }
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      customer_email: invoice.clients?.contact_email ?? undefined,
      line_items: [{ price_data: { currency: 'gbp', product_data: { name: `VirtueCore ${invoice.type ?? 'Invoice'} — ${invoice.clients?.company_name ?? ''}`.trim(), description: invoice.due_date ? `Due: ${invoice.due_date}` : undefined }, unit_amount: Math.round(Number(invoice.amount) * 100) }, quantity: 1 }],
      mode: 'payment',
      success_url: `${appUrl}/client/invoices?paid=true`,
      cancel_url: `${appUrl}/client/invoices`,
      metadata: { invoice_id },
    })
    return res.status(200).json({ url: session.url })
  } catch (err) {
    return res.status(500).json({ error: err.message ?? 'Checkout creation failed' })
  }
}

// ── Router ─────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (!checkRateLimit(req, res)) return
  const action = req.query.action

  // OAuth callback is hit by Stripe directly (no Bearer token possible) — verifies state internally
  if (action === 'oauth-callback') return handleOAuthCallback(req, res)

  // client-connect already has its own Bearer token auth internally
  if (action === 'client-connect') return handleClientConnect(req, res)

  // remaining routes require authentication
  const auth = await authenticateUser(req, res)
  if (!auth) return

  if (action === 'sync-revenue') return handleSyncRevenue(req, res, auth.profile)
  if (action === 'connect') {
    if (!requireRole(res, auth.profile, 'admin')) return
    return handleConnect(req, res)
  }
  if (action === 'create-checkout') return handleCreateCheckout(req, res, auth.profile)
  res.status(404).json({ error: 'Unknown action' })
}
