// Per-client Calendly webhook — the client's own Calendly account posts here
// (via a webhook subscription we create in api/calendly/[action].js), so the
// client_id is known directly from the route, never guessed from an email
// match like the old shared /api/webhooks/calendly path did.
export const config = {
  api: { bodyParser: false },
}

import crypto from 'crypto'
import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'
import { decryptSecret } from '../../_lib/crypto.js'
import { sendBookingNotificationEmail } from '../../_lib/email.js'

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

function verifyCalendlySignature(rawBody, signingKey, signatureHeader) {
  if (!signatureHeader) return false
  const parts = Object.fromEntries(signatureHeader.split(',').map((p) => p.split('=')))
  const t = parts['t']; const v1 = parts['v1']
  if (!t || !v1) return false
  const toSign = `${t}.${rawBody.toString('utf8')}`
  const expected = crypto.createHmac('sha256', signingKey).update(toSign).digest('hex')
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(v1, 'hex'))
  } catch {
    return false
  }
}

// Fire-and-forget on purpose — a notification hiccup should never fail the
// webhook response back to Calendly (which retries on non-2xx).
async function notifyNewBooking(supabase, { clientId, clientName, inviteeName, inviteeEmail, startTime, eventTypeName }) {
  const { data: admins } = await supabase.from('profiles').select('id, email').eq('role', 'admin')
  if (!admins?.length) return

  const title = `📅 New booking — ${clientName || 'a client'}`
  const body = `${inviteeName || 'Someone'} booked ${eventTypeName || 'a call'}`

  await supabase.from('notifications').insert(
    admins.map((a) => ({
      user_id: a.id, type: 'booking_created', title, body,
      meta: { client_id: clientId, invitee_name: inviteeName, start_time: startTime },
    }))
  ).catch(() => {})

  const { VAPID_SUBJECT, VITE_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY } = process.env
  if (VAPID_SUBJECT && VITE_VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(VAPID_SUBJECT, VITE_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
    const { data: subs } = await supabase.from('push_subscriptions').select('*').in('user_id', admins.map((a) => a.id))
    const payload = JSON.stringify({ title, body, url: `/admin/clients/${clientId}/bookings` })
    await Promise.allSettled((subs || []).map((sub) =>
      webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload)
        .catch(async (err) => {
          if (err.statusCode === 410 || err.statusCode === 404) await supabase.from('push_subscriptions').delete().eq('id', sub.id)
        })
    ))
  }

  const slackToken = process.env.SLACK_BOT_TOKEN
  if (slackToken) {
    fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: { Authorization: `Bearer ${slackToken}`, 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        channel: process.env.SLACK_CHANNEL_ID || 'D0APY47HZ25',
        text: title,
        blocks: [
          { type: 'section', text: { type: 'mrkdwn', text: `*${title}*\n${body}` } },
          { type: 'context', elements: [{ type: 'mrkdwn', text: new Date().toUTCString() }] },
        ],
      }),
    }).catch(() => {})
  }

  await Promise.allSettled(admins.filter((a) => a.email).map((a) =>
    sendBookingNotificationEmail({
      email: a.email, clientName, inviteeName, inviteeEmail, startTime, eventTypeName, clientId,
    })
  ))
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const clientId = req.query.clientId
  if (!clientId) return res.status(400).json({ error: 'Missing client id in webhook URL' })

  let rawBody
  try { rawBody = await getRawBody(req) } catch { return res.status(400).json({ error: 'Failed to read request body' }) }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) return res.status(500).json({ error: 'Server not configured' })
  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })

  const { data: client } = await supabase.from('clients')
    .select('id, company_name, calendly_webhook_signing_key_encrypted').eq('id', clientId).maybeSingle()
  if (!client) return res.status(404).json({ error: 'Unknown client' })
  if (!client.calendly_webhook_signing_key_encrypted) return res.status(400).json({ error: 'Calendly not connected for this client' })

  const signingKey = decryptSecret(client.calendly_webhook_signing_key_encrypted)
  const sigHeader = req.headers['calendly-webhook-signature']
  if (!verifyCalendlySignature(rawBody, signingKey, sigHeader)) {
    return res.status(400).json({ error: 'Invalid webhook signature' })
  }

  let payload
  try { payload = JSON.parse(rawBody.toString('utf8')) } catch { return res.status(400).json({ error: 'Invalid JSON body' }) }
  const event = payload?.event
  const eventData = payload?.payload
  if (!event || !eventData) return res.status(400).json({ error: 'Missing event or payload' })

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

  try {
    if (event === 'invitee.created') {
      if (!startTime) return res.status(400).json({ error: 'Missing start_time in payload' })
      await supabase.from('meetings').upsert({
        client_id: clientId, calendly_event_uuid: eventUuid, calendly_invitee_uuid: inviteeUuid,
        event_type_name: eventTypeName || 'Meeting', invitee_name: inviteeName, invitee_email: inviteeEmail,
        start_time: startTime, end_time: endTime, join_url: joinUrl, status: 'active',
      }, { onConflict: 'calendly_event_uuid' })

      notifyNewBooking(supabase, {
        clientId, clientName: client.company_name, inviteeName, inviteeEmail, startTime, eventTypeName,
      }).catch(() => {})
    }
    if (event === 'invitee.canceled') {
      await supabase.from('meetings').update({ status: 'canceled' }).eq('calendly_event_uuid', eventUuid)
    }
    return res.status(200).json({ ok: true })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
