// ─────────────────────────────────────────────────────────────────────────────
// Automated billing cycle logic
// Processes due clients, charges saved cards, handles retries
// ─────────────────────────────────────────────────────────────────────────────
import Stripe from 'stripe'
import { sendBillingReceiptEmail, sendPaymentReminderEmail, sendPaymentFailedEmail } from './email.js'
import { decryptSecret } from './crypto.js'

const RETRY_SCHEDULE_DAYS = [3, 4, 7] // attempt 1 fails → +3 days → +4 days → +7 days = day 0, 3, 7, 14
const MAX_ATTEMPTS = 4

function addDays(date, days) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function toDateString(date) {
  return new Date(date).toISOString().split('T')[0]
}

// Resolves which Stripe client/options to use to read a client's revenue —
// legacy Connect accounts go through the platform Stripe object with a
// stripeAccount header; everyone else (pasted secret key) gets their own
// Stripe instance built from their decrypted key.
// A pasted secret key always wins if one has been saved — see the matching
// note in api/stripe/[action].js's handleSyncRevenue.
function resolveClientChargesReader(platformStripe, client) {
  if (client.stripe_secret_key_encrypted) {
    const decryptedKey = decryptSecret(client.stripe_secret_key_encrypted)
    return { chargesClient: new Stripe(decryptedKey, { apiVersion: '2024-04-10', httpClient: Stripe.createFetchHttpClient() }), chargesOptions: undefined }
  }
  if (client.stripe_account_id) {
    return { chargesClient: platformStripe, chargesOptions: { stripeAccount: client.stripe_account_id } }
  }
  throw new Error('Client has no Stripe connection (neither Connect account nor secret key)')
}

// Sums ad_performance spend for a client over a billing period — used when
// the client's commission basis is "revenue minus ad spend" rather than
// straight revenue, so the agency isn't taking a cut of money the client
// spent on ads within the same period.
async function fetchAdSpendForPeriod(supabase, clientId, periodStartDate, periodEndDate) {
  const { data } = await supabase.from('ad_performance')
    .select('spend')
    .eq('client_id', clientId)
    .gte('date', toDateString(periodStartDate))
    .lte('date', toDateString(periodEndDate))
  return (data || []).reduce((sum, row) => sum + Number(row.spend || 0), 0)
}

// Fetch successful charges from a client's Stripe, net of refunds
async function fetchRevenueForPeriod(chargesClient, chargesOptions, periodStartUnix, periodEndUnix) {
  let revenue = 0
  let chargeSnapshot = []
  let hasMore = true
  let startingAfter

  while (hasMore) {
    const params = { created: { gte: periodStartUnix, lte: periodEndUnix }, limit: 100 }
    if (startingAfter) params.starting_after = startingAfter
    const charges = await chargesClient.charges.list(params, chargesOptions)

    for (const charge of charges.data) {
      if (charge.status === 'succeeded') {
        const refunded = charge.amount_refunded || 0
        const net = (charge.amount - refunded) / 100
        if (net > 0) {
          revenue += net
          chargeSnapshot.push({
            id: charge.id,
            amount: charge.amount / 100,
            refunded: refunded / 100,
            net,
            date: new Date(charge.created * 1000).toISOString().split('T')[0],
            description: charge.description || charge.statement_descriptor || null,
          })
        }
      }
    }

    hasMore = charges.has_more
    startingAfter = charges.data.length > 0 ? charges.data[charges.data.length - 1].id : undefined
  }

  return { revenue, chargeSnapshot }
}

async function sendBillingReceipt(client, invoice) {
  await sendBillingReceiptEmail(client, invoice)
}

async function notifyAdminFailure(client, invoice, errorMessage, attemptNumber) {
  const slackToken = process.env.SLACK_BOT_TOKEN
  if (slackToken) {
    const channel = process.env.SLACK_CHANNEL_ID || 'D0APY47HZ25'
    try {
      await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: { Authorization: `Bearer ${slackToken}`, 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({
          channel,
          text: `Billing charge failed`,
          blocks: [
            { type: 'section', text: { type: 'mrkdwn', text: `*Billing charge failed* (attempt ${attemptNumber}/4)\n*${client.company_name}*\nAmount: £${Number(invoice.amount).toLocaleString()}\nReason: ${errorMessage}` } },
          ],
        }),
      })
    } catch {
      // Best effort
    }
  }

  try {
    await sendPaymentFailedEmail({ email: client.contact_email, fullName: client.contact_name, amount: invoice.amount })
  } catch {
    // Best effort — don't fail the billing run over an email
  }
}

// ── Main: process one client's billing cycle ─────────────────────────────────
export async function processClientBillingCycle(supabase, stripe, client) {
  const today = toDateString(new Date())
  const periodEnd = new Date(client.next_billing_date)
  const periodStart = addDays(periodEnd, -28)
  const periodStartUnix = Math.floor(periodStart.getTime() / 1000)
  const periodEndUnix = Math.floor(periodEnd.getTime() / 1000)

  // 1. Fetch revenue — from the client's Stripe (Connect account or their own
  // pasted key), or from their manually-logged monthly figure for cash-based
  // businesses with no Stripe account to read from at all.
  let revenue = 0
  let chargeSnapshot = []
  if (client.is_cash_business) {
    const monthKey = toDateString(periodEnd).slice(0, 7)
    revenue = Number(client.manual_revenue_by_month?.[monthKey] || 0)
  } else {
    try {
      const { chargesClient, chargesOptions } = resolveClientChargesReader(stripe, client)
      const result = await fetchRevenueForPeriod(chargesClient, chargesOptions, periodStartUnix, periodEndUnix)
      revenue = result.revenue
      chargeSnapshot = result.chargeSnapshot
    } catch (err) {
      return { skipped: true, reason: `Stripe sync failed: ${err.message}`, retry_tomorrow: true }
    }
  }

  // 2. Calculate amounts — commission is either a straight % of revenue, or
  // a % of (revenue minus what the client spent on ads this period), per
  // client.revenue_share_basis.
  const basis = client.revenue_share_basis || 'revenue'
  let adSpend = 0
  if (basis === 'revenue_minus_ad_spend') {
    adSpend = await fetchAdSpendForPeriod(supabase, client.id, periodStart, periodEnd)
  }
  const commissionBase = Math.max(0, revenue - adSpend)
  const commission = Math.round(commissionBase * Number(client.revenue_share_percentage || 0)) / 100
  const retainer = Number(client.monthly_retainer || 0)
  const total = Math.round((commission + retainer) * 100) / 100

  // 3. If total is zero, skip billing but advance the cycle
  if (total <= 0) {
    await supabase.from('clients').update({
      next_billing_date: toDateString(addDays(periodEnd, 28)),
    }).eq('id', client.id)
    return { skipped: true, reason: 'zero amount' }
  }

  // 4. Create invoice in our DB
  const { data: invoice, error: invoiceError } = await supabase.from('invoices').insert({
    client_id: client.id,
    amount: total,
    type: 'auto_billing',
    status: 'auto_charging',
    period_start: toDateString(periodStart),
    period_end: toDateString(periodEnd),
    revenue_amount: revenue,
    ad_spend_amount: adSpend,
    commission_amount: commission,
    retainer_amount: retainer,
    revenue_snapshot: { charges: chargeSnapshot, percentage: client.revenue_share_percentage, basis },
    due_date: today,
  }).select().single()

  if (invoiceError) return { failed: true, error: `DB invoice insert failed: ${invoiceError.message}` }

  // 5. Charge the saved card
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(total * 100),
      currency: 'gbp',
      customer: client.stripe_customer_id,
      payment_method: client.default_payment_method_id,
      off_session: true,
      confirm: true,
      receipt_email: client.contact_email,
      description: `VirtueCore — ${client.company_name} (${invoice.period_start} to ${invoice.period_end})`,
      metadata: {
        invoice_id: invoice.id,
        client_id: client.id,
        period_start: invoice.period_start,
        period_end: invoice.period_end,
      },
    })

    // Mark as paid + advance cycle
    await supabase.from('invoices').update({
      status: 'paid',
      paid_date: today,
      stripe_payment_intent_id: paymentIntent.id,
    }).eq('id', invoice.id)

    await supabase.from('clients').update({
      next_billing_date: toDateString(addDays(periodEnd, 28)),
    }).eq('id', client.id)

    await supabase.from('billing_attempts').insert({
      invoice_id: invoice.id,
      client_id: client.id,
      attempt_number: 1,
      status: 'succeeded',
    })

    await sendBillingReceipt(client, invoice)
    return { ok: true, amount: total, invoice_id: invoice.id }
  } catch (err) {
    // Mark invoice as payment_failed
    await supabase.from('invoices').update({
      status: 'payment_failed',
    }).eq('id', invoice.id)

    const nextRetryAt = addDays(new Date(), RETRY_SCHEDULE_DAYS[0])
    await supabase.from('billing_attempts').insert({
      invoice_id: invoice.id,
      client_id: client.id,
      attempt_number: 1,
      status: 'failed',
      error_message: err.message,
      stripe_error_code: err.code || null,
      next_retry_at: nextRetryAt.toISOString(),
    })

    await notifyAdminFailure(client, invoice, err.message, 1)
    return { failed: true, error: err.message, invoice_id: invoice.id }
  }
}

// ── Process retry attempts ───────────────────────────────────────────────────
export async function processRetryAttempt(supabase, stripe, attempt) {
  const invoice = attempt.invoices
  const client = invoice.clients
  const today = toDateString(new Date())

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(Number(invoice.amount) * 100),
      currency: 'gbp',
      customer: client.stripe_customer_id,
      payment_method: client.default_payment_method_id,
      off_session: true,
      confirm: true,
      receipt_email: client.contact_email,
      description: `VirtueCore retry — ${client.company_name}`,
      metadata: { invoice_id: invoice.id, retry_attempt: attempt.attempt_number + 1 },
    })

    await supabase.from('invoices').update({
      status: 'paid',
      paid_date: today,
      stripe_payment_intent_id: paymentIntent.id,
    }).eq('id', invoice.id)

    await supabase.from('billing_attempts').update({
      status: 'succeeded',
    }).eq('id', attempt.id)

    // Advance billing cycle
    const periodEnd = new Date(invoice.period_end)
    await supabase.from('clients').update({
      next_billing_date: toDateString(addDays(periodEnd, 28)),
    }).eq('id', client.id)

    await sendBillingReceipt(client, invoice)
    return { ok: true, retry_succeeded: true }
  } catch (err) {
    const nextAttemptNumber = attempt.attempt_number + 1

    // Mark current attempt as definitively failed (no retry from this row)
    await supabase.from('billing_attempts').update({
      status: nextAttemptNumber >= MAX_ATTEMPTS ? 'final_failed' : 'failed',
    }).eq('id', attempt.id)

    if (nextAttemptNumber < MAX_ATTEMPTS) {
      // Schedule next retry
      const daysToNext = RETRY_SCHEDULE_DAYS[nextAttemptNumber - 1] || 7
      const nextRetryAt = addDays(new Date(), daysToNext)
      await supabase.from('billing_attempts').insert({
        invoice_id: invoice.id,
        client_id: client.id,
        attempt_number: nextAttemptNumber,
        status: 'failed',
        error_message: err.message,
        stripe_error_code: err.code || null,
        next_retry_at: nextRetryAt.toISOString(),
      })
      await notifyAdminFailure(client, invoice, err.message, nextAttemptNumber)
      return { retry_failed: true, error: err.message, next_retry_at: nextRetryAt.toISOString() }
    } else {
      // Final failure — suspend client and notify admin
      await supabase.from('clients').update({ status: 'churned' }).eq('id', client.id)
      await notifyAdminFailure(client, invoice, `FINAL FAILURE — ${err.message}`, MAX_ATTEMPTS)
      return { final_failure: true, error: err.message }
    }
  }
}

// ── Run a full billing cycle pass (called by cron and manual admin trigger) ──
export async function runBillingCyclePass(supabase, stripe) {
  const today = toDateString(new Date())
  const results = []

  // 1. Process clients due for billing — either a legacy Connect account or a
  // pasted secret key counts as "has a Stripe revenue connection".
  const { data: candidateClients } = await supabase.from('clients')
    .select('id, company_name, contact_name, contact_email, monthly_retainer, revenue_share_percentage, revenue_share_basis, stripe_account_id, stripe_secret_key_encrypted, stripe_customer_id, default_payment_method_id, next_billing_date, is_cash_business, manual_revenue_by_month')
    .eq('status', 'active')
    .eq('auto_charge_enabled', true)
    .not('stripe_customer_id', 'is', null)
    .not('default_payment_method_id', 'is', null)
    .lte('next_billing_date', today)

  const dueClients = (candidateClients || []).filter((c) => c.stripe_account_id || c.stripe_secret_key_encrypted || c.is_cash_business)

  for (const client of dueClients) {
    try {
      const result = await processClientBillingCycle(supabase, stripe, client)
      results.push({ client_id: client.id, company_name: client.company_name, ...result })
    } catch (err) {
      results.push({ client_id: client.id, company_name: client.company_name, error: err.message })
    }
  }

  // 2. Process retry attempts that are due
  const { data: retries } = await supabase.from('billing_attempts')
    .select('*, invoices(*, clients(id, company_name, contact_name, contact_email, stripe_customer_id, default_payment_method_id))')
    .eq('status', 'failed')
    .lte('next_retry_at', new Date().toISOString())

  for (const attempt of retries || []) {
    if (!attempt.invoices?.clients) continue
    try {
      const result = await processRetryAttempt(supabase, stripe, attempt)
      results.push({ retry: true, attempt_id: attempt.id, ...result })
    } catch (err) {
      results.push({ retry: true, attempt_id: attempt.id, error: err.message })
    }
  }

  return results
}

// ── Payment reminder scan — clients billing in exactly 3 days ───────────────
// Uses the last-synced revenue total (not a fresh Stripe call) for a rough
// estimate — good enough for a heads-up email, not used for the actual charge.
export async function runBillingReminderPass(supabase) {
  const reminderDate = toDateString(addDays(new Date(), 3))
  const { data: clients } = await supabase.from('clients')
    .select('id, contact_name, contact_email, monthly_retainer, revenue_share_percentage, stripe_total_revenue, is_cash_business, manual_revenue_by_month, next_billing_date')
    .eq('status', 'active')
    .eq('auto_charge_enabled', true)
    .eq('next_billing_date', reminderDate)

  const results = []
  for (const client of clients || []) {
    const revenueEstimateSource = client.is_cash_business
      ? Number(client.manual_revenue_by_month?.[toDateString(new Date()).slice(0, 7)] || 0)
      : Number(client.stripe_total_revenue || 0)
    const estimatedCommission = Math.round(revenueEstimateSource * Number(client.revenue_share_percentage || 0)) / 100
    const estimatedTotal = estimatedCommission + Number(client.monthly_retainer || 0)
    try {
      await sendPaymentReminderEmail({
        email: client.contact_email,
        fullName: client.contact_name,
        amount: estimatedTotal,
        dueDate: client.next_billing_date,
      })
      results.push({ client_id: client.id, sent: true })
    } catch (err) {
      results.push({ client_id: client.id, sent: false, error: err.message })
    }
  }
  return results
}
