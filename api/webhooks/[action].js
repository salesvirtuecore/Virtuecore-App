// Both Stripe and Calendly webhooks require the raw body for signature verification
export const config = {
  api: { bodyParser: false },
}

import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

// ── /api/webhooks/stripe (POST) ─────────────────────────────────────────────
async function handleStripe(req, res, rawBody) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-04-10', httpClient: Stripe.createFetchHttpClient() })
  const sig = req.headers['stripe-signature']
  let event
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    return res.status(400).json({ error: `Webhook Error: ${err.message}` })
  }
  const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object
        const ourInvoiceId = session.metadata?.invoice_id
        if (ourInvoiceId && session.payment_status === 'paid') {
          const today = new Date().toISOString().split('T')[0]
          await supabase.from('invoices').update({ status: 'paid', paid_date: today }).eq('id', ourInvoiceId)
          const slackToken = process.env.SLACK_BOT_TOKEN
          if (slackToken) {
            const amount = (session.amount_total ?? 0) / 100
            fetch('https://slack.com/api/chat.postMessage', {
              method: 'POST',
              headers: { Authorization: `Bearer ${slackToken}`, 'Content-Type': 'application/json; charset=utf-8' },
              body: JSON.stringify({
                channel: process.env.SLACK_CHANNEL_ID || 'D0APY47HZ25',
                text: `Invoice Paid`,
                blocks: [
                  { type: 'section', text: { type: 'mrkdwn', text: `*Invoice Paid*\n*£${amount.toLocaleString()}* received via card payment` } },
                  { type: 'context', elements: [{ type: 'mrkdwn', text: new Date().toUTCString() }] },
                ],
              }),
            }).catch(() => {})
          }
        }
        break
      }
      case 'invoice.paid': {
        const inv = event.data.object
        await supabase.from('invoices').update({ status: 'paid', paid_date: new Date(inv.status_transitions?.paid_at * 1000).toISOString().split('T')[0] }).eq('stripe_invoice_id', inv.id)
        const slackToken = process.env.SLACK_BOT_TOKEN
        if (slackToken) {
          const amount = (inv.amount_paid ?? inv.amount_due ?? 0) / 100
          fetch('https://slack.com/api/chat.postMessage', {
            method: 'POST',
            headers: { Authorization: `Bearer ${slackToken}`, 'Content-Type': 'application/json; charset=utf-8' },
            body: JSON.stringify({
              channel: process.env.SLACK_CHANNEL_ID || 'D0APY47HZ25',
              text: `💰 Invoice Paid`,
              blocks: [
                { type: 'section', text: { type: 'mrkdwn', text: `*💰 Invoice Paid*\n*£${amount.toLocaleString()}* received\nStripe invoice: ${inv.id}` } },
                { type: 'context', elements: [{ type: 'mrkdwn', text: new Date().toUTCString() }] },
              ],
            }),
          }).catch(() => {})
        }
        break
      }
      case 'invoice.payment_failed': {
        const inv = event.data.object
        await supabase.from('invoices').update({ status: 'overdue' }).eq('stripe_invoice_id', inv.id)
        break
      }
      case 'invoice.created': {
        const inv = event.data.object
        await supabase.from('invoices').update({ stripe_invoice_id: inv.id }).is('stripe_invoice_id', null).eq('status', 'draft').eq('amount', (inv.amount_due ?? 0) / 100)
        break
      }
      case 'setup_intent.succeeded': {
        const setup = event.data.object
        const customerId = setup.customer
        const paymentMethodId = setup.payment_method
        if (customerId && paymentMethodId) {
          // Set as default payment method on the Stripe customer
          try {
            await stripe.customers.update(customerId, {
              invoice_settings: { default_payment_method: paymentMethodId },
            })
          } catch {
            // Best effort
          }
          // Save in our DB
          await supabase.from('clients').update({
            default_payment_method_id: paymentMethodId,
            payment_method_added_at: new Date().toISOString(),
          }).eq('stripe_customer_id', customerId)
        }
        break
      }
      case 'payment_intent.payment_failed': {
        const pi = event.data.object
        const invoiceId = pi.metadata?.invoice_id
        if (invoiceId) {
          await supabase.from('invoices').update({ status: 'payment_failed' }).eq('id', invoiceId)
        }
        break
      }
      default:
        console.log(`Unhandled Stripe event: ${event.type}`)
    }
    return res.status(200).json({ received: true })
  } catch (err) {
    return res.status(500).json({ error: 'Processing error', detail: err.message })
  }
}

// Calendly webhooks now route per-client to /api/webhooks/calendly/[clientId]
// (see that file) — each client's own Calendly account posts there directly,
// so client_id comes from the route instead of being guessed from an email
// match. This single shared /api/webhooks/calendly path is retired.

// ── Router ─────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  let rawBody
  try { rawBody = await getRawBody(req) } catch { return res.status(400).json({ error: 'Failed to read request body' }) }
  const action = req.query.action
  if (action === 'stripe') return handleStripe(req, res, rawBody)
  res.status(404).json({ error: 'Unknown webhook source' })
}
