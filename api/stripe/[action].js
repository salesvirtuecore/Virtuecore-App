import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { authenticateUser, requireRole, requireClientOwnership, makeSupabase, checkRateLimit, getAppUrl } from '../_lib/auth.js'
import { encryptSecret, decryptSecret, maskSecret } from '../_lib/crypto.js'

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

// ── /api/stripe/client-connect (GET) ────────────────────────────────────────
// Returns connection status + revenue totals for the authenticated client.
async function handleClientConnect(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const stripeSecret = process.env.STRIPE_SECRET_KEY
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

    // Fetch revenue totals + payment method status for this client
    const { data: clientFull, error: clientFullError } = await supabase.from('clients')
      .select('id, company_name, contact_email, stripe_account_id, stripe_connected_at, stripe_total_revenue, stripe_revenue_last_90d, stripe_revenue_synced_at, stripe_revenue_by_month, stripe_active_subscriptions, stripe_mrr, stripe_customer_count, stripe_customer_id, default_payment_method_id, payment_method_added_at, next_billing_date, monthly_retainer, revenue_share_percentage, revenue_share_basis, manual_costs_by_month, meta_ad_account_id, stripe_secret_key_valid, stripe_secret_key_masked, stripe_key_added_at')
      .eq('id', client.id).maybeSingle()
    if (clientFullError) return res.status(500).json({ error: `Failed to load client record: ${clientFullError.message}` })
    if (!clientFull) return res.status(404).json({ error: 'Client record not found' })
    const stripeAccountId = clientFull?.stripe_account_id || null

    // A pasted secret key always wins if one has been saved — same priority
    // as handleSyncRevenue. Legacy Connect accounts only report live OAuth
    // status for clients who never re-keyed.
    const stripeStatus = clientFull?.stripe_secret_key_valid
      ? {
          connected: true,
          onboardingComplete: true,
          chargesEnabled: true,
          payoutsEnabled: false,
        }
      : stripeAccountId
        ? await loadStripeAccountStatus({ stripe, stripeAccountId })
        : { connected: false, onboardingComplete: false, chargesEnabled: false, payoutsEnabled: false }

    // Fetch saved card details for display (last4, brand) — this is the PLATFORM's
    // own Stripe customer/payment-method (used for auto-billing), unrelated to the
    // client's own pasted Stripe key above.
    let savedCard = null
    if (clientFull?.stripe_customer_id && clientFull?.default_payment_method_id) {
      try {
        const pm = await stripe.paymentMethods.retrieve(clientFull.default_payment_method_id)
        if (pm?.card) {
          savedCard = { brand: pm.card.brand, last4: pm.card.last4, exp_month: pm.card.exp_month, exp_year: pm.card.exp_year }
        }
      } catch {
        // Card might have been deleted in Stripe
      }
    }

    return res.status(200).json({
      clientId: clientFull.id,
      companyName: clientFull.company_name || null,
      contactEmail: clientFull.contact_email || user.email || null,
      stripeAccountId,
      connectedAt: clientFull.stripe_connected_at,
      stripeKeyValid: Boolean(clientFull.stripe_secret_key_valid),
      stripeKeyMasked: clientFull.stripe_secret_key_masked || null,
      stripeKeyAddedAt: clientFull.stripe_key_added_at || null,
      totalRevenue: Number(clientFull.stripe_total_revenue || 0),
      revenueLast90Days: Number(clientFull.stripe_revenue_last_90d || 0),
      revenueSyncedAt: clientFull.stripe_revenue_synced_at,
      revenueByMonth: clientFull.stripe_revenue_by_month || {},
      activeSubscriptions: Number(clientFull.stripe_active_subscriptions || 0),
      mrr: Number(clientFull.stripe_mrr || 0),
      customerCount: Number(clientFull.stripe_customer_count || 0),
      savedCard,
      nextBillingDate: clientFull.next_billing_date,
      monthlyRetainer: Number(clientFull.monthly_retainer || 0),
      revenueSharePercentage: Number(clientFull.revenue_share_percentage || 0),
      revenueShareBasis: clientFull.revenue_share_basis || 'revenue',
      manualCostsByMonth: clientFull.manual_costs_by_month || {},
      metaConnected: Boolean(clientFull.meta_ad_account_id),
      ...stripeStatus,
    })
  } catch (err) {
    return res.status(500).json({ error: err?.message || 'Stripe connect failed' })
  }
}

// ── /api/stripe/save-secret-key (POST) ──────────────────────────────────────
// Client pastes their own Stripe secret key. We verify it against Stripe,
// then encrypt it at rest — the plaintext key is never stored or returned.
async function handleSaveSecretKey(req, res, authProfile) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!requireRole(res, authProfile, 'client', 'admin')) return

  const { secret_key } = req.body ?? {}
  const targetClientId = authProfile.role === 'admin' ? req.body?.client_id : authProfile.client_id
  if (!targetClientId) return res.status(400).json({ error: 'client_id required' })
  if (!requireClientOwnership(res, authProfile, targetClientId)) return

  if (!secret_key || typeof secret_key !== 'string' || !/^sk_(live|test)_/.test(secret_key)) {
    return res.status(400).json({ error: "That doesn't look like a valid Stripe secret key — it should start with sk_live_ or sk_test_" })
  }

  try {
    const clientStripe = new Stripe(secret_key, { apiVersion: '2024-04-10', httpClient: Stripe.createFetchHttpClient() })
    await clientStripe.balance.retrieve() // proves the key actually works before we save it
  } catch (err) {
    return res.status(400).json({ error: `Stripe rejected this key: ${err?.message || 'invalid key'}` })
  }

  try {
    const encrypted = encryptSecret(secret_key)
    const masked = maskSecret(secret_key)
    const supabase = makeSupabase()
    const { error } = await supabase.from('clients').update({
      stripe_secret_key_encrypted: encrypted,
      stripe_secret_key_masked: masked,
      stripe_secret_key_valid: true,
      stripe_key_added_at: new Date().toISOString(),
      stripe_key_last_validated_at: new Date().toISOString(),
    }).eq('id', targetClientId)
    if (error) return res.status(500).json({ error: error.message })

    // Sync revenue immediately so the dashboard never shows stale/zero
    // numbers between "key saved" and someone happening to click "Sync now".
    let revenue = null
    try {
      const platformStripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-04-10', httpClient: Stripe.createFetchHttpClient() })
      const result = await syncRevenueForClient(targetClientId, { supabase, platformStripe })
      revenue = { totalRevenue: result.totalRevenue, revenueLast90Days: result.revenueLast90Days }
    } catch (syncErr) {
      console.error('Post-save revenue sync failed:', syncErr?.message)
    }

    return res.status(200).json({ ok: true, masked, revenue })
  } catch (err) {
    return res.status(500).json({ error: err?.message || 'Failed to save key' })
  }
}

// ── /api/stripe/setup-payment-method (POST) ─────────────────────────────────
// Returns a Stripe Checkout Session in 'setup' mode so the client can save a card.
async function handleSetupPaymentMethod(req, res, authProfile) {
  if (req.method !== 'POST') return res.status(405).end()
  if (!authProfile.client_id) return res.status(403).json({ error: 'No client linked to your account' })

  const stripeSecret = process.env.STRIPE_SECRET_KEY
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!stripeSecret) return res.status(500).json({ error: 'Stripe not configured' })

  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
  const stripe = new Stripe(stripeSecret, { apiVersion: '2024-04-10', httpClient: Stripe.createFetchHttpClient() })

  try {
    const { data: client } = await supabase.from('clients')
      .select('id, company_name, contact_email, stripe_customer_id')
      .eq('id', authProfile.client_id).single()
    if (!client) return res.status(404).json({ error: 'Client not found' })

    // Create or reuse Stripe Customer
    let customerId = client.stripe_customer_id
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: client.contact_email,
        name: client.company_name,
        metadata: { client_id: client.id },
      })
      customerId = customer.id
      await supabase.from('clients').update({ stripe_customer_id: customerId }).eq('id', client.id)
    }

    // Create a Checkout Session in setup mode
    const appUrl = getAppUrl()
    const session = await stripe.checkout.sessions.create({
      mode: 'setup',
      customer: customerId,
      payment_method_types: ['card'],
      success_url: `${appUrl}/client/billing?card_added=true`,
      cancel_url: `${appUrl}/client/billing`,
      metadata: { client_id: client.id },
    })

    return res.status(200).json({ url: session.url })
  } catch (err) {
    return res.status(500).json({ error: err?.message || 'Setup failed' })
  }
}

// Normalizes a Stripe subscription price to a monthly-equivalent amount —
// e.g. an annual £1200 plan and a monthly £100 plan both report as £100/mo,
// so MRR is comparable across mixed billing intervals.
function monthlyEquivalent(price, quantity) {
  if (!price?.unit_amount || !price?.recurring) return 0
  const amount = (price.unit_amount * (quantity || 1)) / 100
  const intervalCount = price.recurring.interval_count || 1
  switch (price.recurring.interval) {
    case 'year': return amount / (12 * intervalCount)
    case 'month': return amount / intervalCount
    case 'week': return (amount * 4.345) / intervalCount
    case 'day': return (amount * 30.44) / intervalCount
    default: return 0
  }
}

// ── Shared Stripe overview core ─────────────────────────────────────────────
// Fetches all successful charges, active subscriptions, and customers from a
// Stripe account since `sinceUnix`, returning totals plus a month-by-month
// revenue breakdown. Pure function (no Supabase) — used both for a specific
// client's connected account (syncRevenueForClient, persisted to their row)
// and for the agency's own account (handleAgencyOverview, computed live on
// each admin dashboard load, nothing to persist).
async function computeStripeOverview(chargesClient, chargesOptions, sinceUnix) {
  const ninetyDaysAgoUnix = Math.floor(Date.now() / 1000) - 90 * 86400
  const last90StartUnix = Math.max(sinceUnix, ninetyDaysAgoUnix)

  let totalRevenue = 0
  let revenueLast90Days = 0
  let chargeCount = 0
  const revenueByMonth = {}
  let hasMore = true
  let startingAfter

  while (hasMore) {
    const params = { created: { gte: sinceUnix }, limit: 100 }
    if (startingAfter) params.starting_after = startingAfter
    const charges = await chargesClient.charges.list(params, chargesOptions)

    for (const charge of charges.data) {
      if (charge.status === 'succeeded') {
        const net = (charge.amount - (charge.amount_refunded || 0)) / 100
        totalRevenue += net
        chargeCount++
        if (charge.created >= last90StartUnix) revenueLast90Days += net
        const monthKey = new Date(charge.created * 1000).toISOString().slice(0, 7)
        revenueByMonth[monthKey] = Number(((revenueByMonth[monthKey] || 0) + net).toFixed(2))
      }
    }

    hasMore = charges.has_more
    startingAfter = charges.data.length > 0 ? charges.data[charges.data.length - 1].id : undefined
  }

  // Active/trialing subscriptions -> count + normalized MRR
  let activeSubscriptions = 0
  let mrr = 0
  hasMore = true
  startingAfter = undefined
  while (hasMore) {
    const params = { status: 'all', limit: 100 }
    if (startingAfter) params.starting_after = startingAfter
    const subs = await chargesClient.subscriptions.list(params, chargesOptions)

    for (const sub of subs.data) {
      if (sub.status === 'active' || sub.status === 'trialing') {
        activeSubscriptions++
        for (const item of sub.items?.data || []) {
          mrr += monthlyEquivalent(item.price, item.quantity)
        }
      }
    }

    hasMore = subs.has_more
    startingAfter = subs.data.length > 0 ? subs.data[subs.data.length - 1].id : undefined
  }
  mrr = Number(mrr.toFixed(2))

  // Customers -> total count
  let customerCount = 0
  hasMore = true
  startingAfter = undefined
  while (hasMore) {
    const params = { limit: 100 }
    if (startingAfter) params.starting_after = startingAfter
    const customers = await chargesClient.customers.list(params, chargesOptions)
    customerCount += customers.data.length
    hasMore = customers.has_more
    startingAfter = customers.data.length > 0 ? customers.data[customers.data.length - 1].id : undefined
  }

  return { totalRevenue, revenueLast90Days, chargeCount, revenueByMonth, activeSubscriptions, mrr, customerCount }
}

// ── Shared revenue-sync core ────────────────────────────────────────────────
// Resolves a client's connected Stripe account, computes their overview, and
// persists it to their row (used both by the standalone sync-revenue action
// and immediately after a key is (re)saved, so a freshly pasted key is never
// left showing stale/zero data until someone happens to click "Sync now").
async function syncRevenueForClient(clientId, { supabase, platformStripe }) {
  const { data: client } = await supabase.from('clients')
    .select('id, stripe_account_id, stripe_secret_key_encrypted, onboarding_started_at, created_at')
    .eq('id', clientId).maybeSingle()
  if (!client) throw Object.assign(new Error('Client not found'), { status: 404 })

  // A pasted secret key always wins if one has been saved — it's the client's
  // own real Stripe account and the whole point of replacing OAuth. Legacy
  // Connect accounts (stripeAccount header on the platform Stripe object) are
  // only used as a fallback for clients who never re-keyed.
  let chargesClient = platformStripe
  let chargesOptions

  if (client.stripe_secret_key_encrypted) {
    const decryptedKey = decryptSecret(client.stripe_secret_key_encrypted)
    chargesClient = new Stripe(decryptedKey, { apiVersion: '2024-04-10', httpClient: Stripe.createFetchHttpClient() })
  } else if (client.stripe_account_id) {
    chargesOptions = { stripeAccount: client.stripe_account_id }
  } else {
    throw Object.assign(new Error('Stripe not connected — please add your Stripe secret key first'), { status: 400 })
  }

  // "Since joining VirtueCore"
  const joinDate = client.onboarding_started_at || client.created_at
  const joinUnix = Math.floor(new Date(joinDate).getTime() / 1000)

  const overview = await computeStripeOverview(chargesClient, chargesOptions, joinUnix)

  await supabase.from('clients').update({
    stripe_total_revenue: overview.totalRevenue,
    stripe_revenue_last_90d: overview.revenueLast90Days,
    stripe_revenue_synced_at: new Date().toISOString(),
    stripe_revenue_by_month: overview.revenueByMonth,
    stripe_active_subscriptions: overview.activeSubscriptions,
    stripe_mrr: overview.mrr,
    stripe_customer_count: overview.customerCount,
  }).eq('id', clientId)

  return { ...overview, joinDate }
}

// ── /api/stripe/sync-revenue (POST) ─────────────────────────────────────────
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

  try {
    const result = await syncRevenueForClient(clientId, { supabase, platformStripe: stripe })
    return res.status(200).json({
      ok: true,
      total_revenue: result.totalRevenue,
      revenue_last_90_days: result.revenueLast90Days,
      charge_count: result.chargeCount,
      since: result.joinDate,
      revenue_by_month: result.revenueByMonth,
      active_subscriptions: result.activeSubscriptions,
      mrr: result.mrr,
      customer_count: result.customerCount,
    })
  } catch (err) {
    return res.status(err?.status || 500).json({ error: err?.message || 'Sync failed' })
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
  const appUrl = getAppUrl()
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

// ── /api/stripe/save-manual-cost (POST) ─────────────────────────────────────
// Lets a client (or admin, on their behalf) record their own monthly
// operating cost — subscriptions/tools not visible in Stripe — for a given
// month. This feeds the CAC figure on the client dashboard: (ad spend +
// manual cost) / conversions, so cost-per-acquisition isn't blind to
// spend outside ad platforms.
async function handleSaveManualCost(req, res, authProfile) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!requireRole(res, authProfile, 'client', 'admin')) return

  const { month, amount } = req.body ?? {}
  const targetClientId = authProfile.role === 'admin' ? req.body?.client_id : authProfile.client_id
  if (!targetClientId) return res.status(400).json({ error: 'client_id required' })
  if (!requireClientOwnership(res, authProfile, targetClientId)) return

  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return res.status(400).json({ error: 'month must be in YYYY-MM format' })
  }
  const numericAmount = Number(amount)
  if (!Number.isFinite(numericAmount) || numericAmount < 0) {
    return res.status(400).json({ error: 'amount must be a non-negative number' })
  }

  const supabase = makeSupabase()
  const { data: client, error: fetchError } = await supabase.from('clients')
    .select('id, manual_costs_by_month').eq('id', targetClientId).maybeSingle()
  if (fetchError) return res.status(500).json({ error: fetchError.message })
  if (!client) return res.status(404).json({ error: 'Client not found' })

  const updated = { ...(client.manual_costs_by_month || {}), [month]: numericAmount }
  const { error: updateError } = await supabase.from('clients')
    .update({ manual_costs_by_month: updated }).eq('id', targetClientId)
  if (updateError) return res.status(500).json({ error: updateError.message })

  return res.status(200).json({ ok: true, manual_costs_by_month: updated })
}

// ── /api/stripe/agency-overview (GET) — admin only ──────────────────────────
// The agency's OWN real Stripe revenue — powers the admin dashboard's
// revenue chart/forecast directly from Stripe instead of internal DB
// aggregates (monthly_retainer sums, which reflect contracted value, not
// what was actually charged/collected). Computed live on each load rather
// than persisted, since this is a single low-traffic view, not per-client
// data that needs to survive across sessions.
async function handleAgencyOverview(req, res) {
  const agencyKey = process.env.AGENCY_STRIPE_SECRET_KEY
  if (!agencyKey) return res.status(200).json({ connected: false, reason: 'not_configured' })

  try {
    const stripe = new Stripe(agencyKey, { apiVersion: '2024-04-10', httpClient: Stripe.createFetchHttpClient() })
    // Look back 12 months for a chart with enough history for a meaningful trend/forecast
    const sinceUnix = Math.floor(Date.now() / 1000) - 365 * 86400
    const overview = await computeStripeOverview(stripe, undefined, sinceUnix)
    return res.status(200).json({ connected: true, ...overview })
  } catch (err) {
    return res.status(500).json({ connected: false, error: err?.message || 'Failed to load agency revenue' })
  }
}

// ── Router ─────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (!checkRateLimit(req, res)) return
  const action = req.query.action

  // client-connect already has its own Bearer token auth internally
  if (action === 'client-connect') return handleClientConnect(req, res)

  // remaining routes require authentication
  const auth = await authenticateUser(req, res)
  if (!auth) return

  if (action === 'save-secret-key') return handleSaveSecretKey(req, res, auth.profile)
  if (action === 'sync-revenue') return handleSyncRevenue(req, res, auth.profile)
  if (action === 'save-manual-cost') return handleSaveManualCost(req, res, auth.profile)
  if (action === 'setup-payment-method') return handleSetupPaymentMethod(req, res, auth.profile)
  if (action === 'connect') {
    if (!requireRole(res, auth.profile, 'admin')) return
    return handleConnect(req, res)
  }
  if (action === 'agency-overview') {
    if (!requireRole(res, auth.profile, 'admin')) return
    return handleAgencyOverview(req, res)
  }
  if (action === 'create-checkout') return handleCreateCheckout(req, res, auth.profile)
  res.status(404).json({ error: 'Unknown action' })
}
