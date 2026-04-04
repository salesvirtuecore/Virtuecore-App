import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

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
async function handleClientConnect(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const stripeSecret = process.env.STRIPE_SECRET_KEY
  const returnUrl = process.env.STRIPE_CONNECT_CLIENT_RETURN_URL || 'https://app.virtuecore.co.uk/client/billing'
  const refreshUrl = process.env.STRIPE_CONNECT_CLIENT_REFRESH_URL || 'https://app.virtuecore.co.uk/client/billing'
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
    let stripeAccountId = client?.stripe_account_id || null
    if (req.method === 'GET') {
      const stripeStatus = await loadStripeAccountStatus({ stripe, stripeAccountId })
      return res.status(200).json({ clientId: client.id, companyName: client.company_name || null, contactEmail: client.contact_email || user.email || null, stripeAccountId, ...stripeStatus })
    }
    if (!stripeAccountId) {
      const account = await stripe.accounts.create({
        type: 'express', country: 'GB', email: client.contact_email || user.email,
        capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
        metadata: { client_id: client.id, client_email: client.contact_email || user.email || '', company_name: client.company_name || '' },
      })
      stripeAccountId = account.id
      const { error: updateError } = await supabase.from('clients').update({ stripe_account_id: stripeAccountId }).eq('id', client.id)
      if (updateError) throw updateError
    }
    const stripeStatus = await loadStripeAccountStatus({ stripe, stripeAccountId })
    let connectUrl = null
    if (stripeStatus.onboardingComplete) {
      const loginLink = await stripe.accounts.createLoginLink(stripeAccountId)
      connectUrl = loginLink.url
    } else {
      const onboardingLink = await stripe.accountLinks.create({ account: stripeAccountId, refresh_url: refreshUrl, return_url: returnUrl, type: 'account_onboarding' })
      connectUrl = onboardingLink.url
    }
    return res.status(200).json({ connectUrl, stripeAccountId, clientId: client.id, companyName: client.company_name || null, ...stripeStatus })
  } catch (err) {
    const message = err?.message || 'Stripe connect failed'
    if (message.includes('managing losses')) return res.status(400).json({ error: 'Platform setup required: Admin must complete Stripe Connect platform profile.' })
    if (message.includes('could not be activated') || message.includes('signed up for Connect')) return res.status(400).json({ error: 'Stripe Connect is not enabled on this platform account yet.' })
    return res.status(500).json({ error: message })
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
async function handleCreateCheckout(req, res) {
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
  const action = req.query.action
  if (action === 'client-connect') return handleClientConnect(req, res)
  if (action === 'connect') return handleConnect(req, res)
  if (action === 'create-checkout') return handleCreateCheckout(req, res)
  res.status(404).json({ error: 'Unknown action' })
}
