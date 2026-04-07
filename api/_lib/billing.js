// ─────────────────────────────────────────────────────────────────────────────
// Automated billing cycle logic
// Processes due clients, charges saved cards, handles retries
// ─────────────────────────────────────────────────────────────────────────────
import nodemailer from 'nodemailer'

const RETRY_SCHEDULE_DAYS = [3, 4, 7] // attempt 1 fails → +3 days → +4 days → +7 days = day 0, 3, 7, 14
const MAX_ATTEMPTS = 4

function createMailTransport() {
  const user = process.env.EMAIL_USER
  const pass = process.env.EMAIL_PASS
  if (!user || !pass) return null
  return nodemailer.createTransport({ service: 'gmail', auth: { user, pass } })
}

function addDays(date, days) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function toDateString(date) {
  return new Date(date).toISOString().split('T')[0]
}

// Fetch successful charges from a connected Stripe account, net of refunds
async function fetchRevenueForPeriod(stripe, stripeAccountId, periodStartUnix, periodEndUnix) {
  let revenue = 0
  let chargeSnapshot = []
  let hasMore = true
  let startingAfter

  while (hasMore) {
    const params = { created: { gte: periodStartUnix, lte: periodEndUnix }, limit: 100 }
    if (startingAfter) params.starting_after = startingAfter
    const charges = await stripe.charges.list(params, { stripeAccount: stripeAccountId })

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
  const transport = createMailTransport()
  if (!transport || !client.contact_email) return
  const appUrl = process.env.VITE_APP_URL || 'https://app.virtuecore.co.uk'
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 540px; margin: 0 auto; padding: 32px 0;">
      <div style="background: #7C3AED; padding: 24px 32px; border-radius: 8px 8px 0 0;">
        <h1 style="color: #fff; font-size: 20px; margin: 0;">VirtueCore — Payment Received</h1>
      </div>
      <div style="background: #ffffff; padding: 32px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
        <p style="font-size: 15px; color: #111827; margin: 0 0 16px;">Hi ${client.contact_name || 'there'},</p>
        <p style="font-size: 15px; color: #111827; line-height: 1.6; margin: 0 0 24px;">
          We've successfully charged your card on file for your VirtueCore monthly cycle. Here's the breakdown:
        </p>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
          <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Period</td><td style="padding: 8px 0; text-align: right; color: #111827; font-size: 14px;">${invoice.period_start} to ${invoice.period_end}</td></tr>
          <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Revenue tracked from Stripe</td><td style="padding: 8px 0; text-align: right; color: #111827; font-size: 14px;">£${Number(invoice.revenue_amount || 0).toLocaleString()}</td></tr>
          <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Commission</td><td style="padding: 8px 0; text-align: right; color: #111827; font-size: 14px;">£${Number(invoice.commission_amount || 0).toLocaleString()}</td></tr>
          <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Monthly retainer</td><td style="padding: 8px 0; text-align: right; color: #111827; font-size: 14px;">£${Number(invoice.retainer_amount || 0).toLocaleString()}</td></tr>
          <tr style="border-top: 1px solid #e5e7eb;"><td style="padding: 12px 0 0; color: #111827; font-size: 16px; font-weight: 600;">Total charged</td><td style="padding: 12px 0 0; text-align: right; color: #111827; font-size: 16px; font-weight: 600;">£${Number(invoice.amount).toLocaleString()}</td></tr>
        </table>
        <a href="${appUrl}/client/invoices" style="display: inline-block; background: #7C3AED; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-size: 14px; font-weight: 600;">View invoice details</a>
        <p style="font-size: 13px; color: #6b7280; margin-top: 24px;">Stripe will also send you an official receipt separately.</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
        <p style="font-size: 13px; color: #9ca3af; margin: 0;">VirtueCore — sales@virtuecore.co.uk</p>
      </div>
    </div>`
  try {
    await transport.sendMail({
      from: process.env.EMAIL_FROM || `VirtueCore <${process.env.EMAIL_USER}>`,
      to: client.contact_email,
      subject: `Payment received — £${Number(invoice.amount).toLocaleString()}`,
      html,
    })
  } catch {
    // Don't fail the whole billing run if email fails
  }
}

async function notifyAdminFailure(client, invoice, errorMessage, attemptNumber) {
  const slackToken = process.env.SLACK_BOT_TOKEN
  if (!slackToken) return
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

// ── Main: process one client's billing cycle ─────────────────────────────────
export async function processClientBillingCycle(supabase, stripe, client) {
  const today = toDateString(new Date())
  const periodEnd = new Date(client.next_billing_date)
  const periodStart = addDays(periodEnd, -28)
  const periodStartUnix = Math.floor(periodStart.getTime() / 1000)
  const periodEndUnix = Math.floor(periodEnd.getTime() / 1000)

  // 1. Fetch revenue from connected Stripe
  let revenue = 0
  let chargeSnapshot = []
  try {
    const result = await fetchRevenueForPeriod(stripe, client.stripe_account_id, periodStartUnix, periodEndUnix)
    revenue = result.revenue
    chargeSnapshot = result.chargeSnapshot
  } catch (err) {
    return { skipped: true, reason: `Stripe sync failed: ${err.message}`, retry_tomorrow: true }
  }

  // 2. Calculate amounts
  const commission = Math.round(revenue * Number(client.revenue_share_percentage || 0)) / 100
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
    commission_amount: commission,
    retainer_amount: retainer,
    revenue_snapshot: { charges: chargeSnapshot, percentage: client.revenue_share_percentage },
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

  // 1. Process clients due for billing
  const { data: dueClients } = await supabase.from('clients')
    .select('id, company_name, contact_name, contact_email, monthly_retainer, revenue_share_percentage, stripe_account_id, stripe_customer_id, default_payment_method_id, next_billing_date')
    .eq('status', 'active')
    .eq('auto_charge_enabled', true)
    .not('stripe_account_id', 'is', null)
    .not('stripe_customer_id', 'is', null)
    .not('default_payment_method_id', 'is', null)
    .lte('next_billing_date', today)

  for (const client of dueClients || []) {
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
