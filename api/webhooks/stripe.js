// /api/webhooks/stripe.js
// Stripe webhook handler — verifies signature and updates invoice records.
//
// Handles events:
//   invoice.paid           → status='paid', paid_date set
//   invoice.payment_failed → status='overdue'
//   invoice.created        → update if stripe_invoice_id already exists
//
// NOTE: Vercel disables body parsing for this route via the config export below.
// Required env vars: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

// Tell Vercel not to parse the body — Stripe needs the raw buffer to verify signature
export const config = {
  api: {
    bodyParser: false,
  },
}

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2024-04-10',
  })

  const sig = req.headers['stripe-signature']
  let event

  try {
    const rawBody = await getRawBody(req)
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    )
  } catch (err) {
    console.error('Stripe signature verification failed:', err.message)
    return res.status(400).json({ error: `Webhook Error: ${err.message}` })
  }

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  try {
    switch (event.type) {
      case 'invoice.paid': {
        const stripeInvoice = event.data.object
        await supabase
          .from('invoices')
          .update({
            status: 'paid',
            paid_date: new Date(stripeInvoice.status_transitions?.paid_at * 1000)
              .toISOString()
              .split('T')[0],
          })
          .eq('stripe_invoice_id', stripeInvoice.id)
        break
      }

      case 'invoice.payment_failed': {
        const stripeInvoice = event.data.object
        await supabase
          .from('invoices')
          .update({ status: 'overdue' })
          .eq('stripe_invoice_id', stripeInvoice.id)
        break
      }

      case 'invoice.created': {
        const stripeInvoice = event.data.object
        // Only update if there's already a matching record
        await supabase
          .from('invoices')
          .update({ stripe_invoice_id: stripeInvoice.id })
          .is('stripe_invoice_id', null)
          .eq('status', 'draft')
          // Match by amount if possible
          .eq('amount', (stripeInvoice.amount_due ?? 0) / 100)
        break
      }

      default:
        console.log(`Unhandled Stripe event type: ${event.type}`)
    }

    return res.status(200).json({ received: true })
  } catch (err) {
    console.error('Stripe webhook processing error:', err)
    return res.status(500).json({ error: 'Processing error', detail: err.message })
  }
}
