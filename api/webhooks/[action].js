// Both Stripe and Calendly webhooks require the raw body for signature verification
export const config = {
  api: { bodyParser: false },
}

import Stripe from 'stripe'
import crypto from 'crypto'
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
      default:
        console.log(`Unhandled Stripe event: ${event.type}`)
    }
    return res.status(200).json({ received: true })
  } catch (err) {
    return res.status(500).json({ error: 'Processing error', detail: err.message })
  }
}

// ── /api/webhooks/calendly (POST) ───────────────────────────────────────────
function verifyCalendlySignature(rawBody, signingKey, signatureHeader) {
  if (!signatureHeader) return false
  const parts = Object.fromEntries(signatureHeader.split(',').map((p) => p.split('=')))
  const t = parts['t']; const v1 = parts['v1']
  if (!t || !v1) return false
  const toSign = `${t}.${rawBody.toString('utf8')}`
  const expected = crypto.createHmac('sha256', signingKey).update(toSign).digest('hex')
  return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(v1, 'hex'))
}

async function handleCalendly(req, res, rawBody) {
  const signingKey = process.env.CALENDLY_WEBHOOK_SIGNING_KEY
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) return res.status(500).json({ error: 'Server not configured' })
  if (signingKey) {
    const sigHeader = req.headers['calendly-webhook-signature']
    if (!verifyCalendlySignature(rawBody, signingKey, sigHeader)) {
      return res.status(400).json({ error: 'Invalid webhook signature' })
    }
  }
  let payload
  try { payload = JSON.parse(rawBody.toString('utf8')) } catch { return res.status(400).json({ error: 'Invalid JSON body' }) }
  const event = payload?.event
  const eventData = payload?.payload
  if (!event || !eventData) return res.status(400).json({ error: 'Missing event or payload' })
  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
  const inviteeEmail = eventData?.email || eventData?.invitee?.email || null
  const inviteeName = eventData?.name || eventData?.invitee?.name || null
  const startTime = eventData?.event?.start_time || eventData?.scheduled_event?.start_time || null
  const endTime = eventData?.event?.end_time || eventData?.scheduled_event?.end_time || null
  const joinUrl = eventData?.event?.location?.join_url || null
  const eventTypeName = eventData?.event_type?.name || eventData?.scheduled_event?.name || null
  const eventUri = eventData?.event?.uri || eventData?.scheduled_event?.uri || ''
  const inviteeUri = eventData?.uri || ''
  const eventUuid = eventUri.split('/').pop() || null
  const inviteeUuid = inviteeUri.split('/').pop() || null
  if (!startTime) return res.status(400).json({ error: 'Missing start_time in payload' })
  let clientId = null
  if (inviteeEmail) {
    const { data: profile } = await supabase.from('profiles').select('client_id').ilike('email', inviteeEmail).maybeSingle()
    if (profile?.client_id) {
      clientId = profile.client_id
    } else {
      const { data: client } = await supabase.from('clients').select('id').ilike('contact_email', inviteeEmail).maybeSingle()
      clientId = client?.id || null
    }
  }
  try {
    if (event === 'invitee.created') {
      await supabase.from('meetings').upsert({ client_id: clientId, calendly_event_uuid: eventUuid, calendly_invitee_uuid: inviteeUuid, event_type_name: eventTypeName || 'Meeting', invitee_name: inviteeName, invitee_email: inviteeEmail, start_time: startTime, end_time: endTime, join_url: joinUrl, status: 'active' }, { onConflict: 'calendly_event_uuid' })
    }
    if (event === 'invitee.canceled') {
      await supabase.from('meetings').update({ status: 'canceled' }).eq('calendly_event_uuid', eventUuid)
    }
    return res.status(200).json({ ok: true })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}

// ── Router ─────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  let rawBody
  try { rawBody = await getRawBody(req) } catch { return res.status(400).json({ error: 'Failed to read request body' }) }
  const action = req.query.action
  if (action === 'stripe') return handleStripe(req, res, rawBody)
  if (action === 'calendly') return handleCalendly(req, res, rawBody)
  res.status(404).json({ error: 'Unknown webhook source' })
}
