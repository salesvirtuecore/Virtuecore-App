// /api/webhooks/calendly.js
// Calendly webhook handler — verifies signature, stores bookings in Supabase.
//
// Handles events:
//   invitee.created   → inserts a meeting row (status = 'active')
//   invitee.canceled  → updates meeting row (status = 'canceled')
//
// Required env vars:
//   CALENDLY_WEBHOOK_SIGNING_KEY  (from Calendly Developer → Webhooks)
//   SUPABASE_URL or VITE_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//
// Tell Vercel not to parse the body — we need the raw buffer to verify signature
export const config = {
  api: { bodyParser: false },
}

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

function verifyCalendlySignature(rawBody, signingKey, signatureHeader) {
  // Header format: t=<timestamp>,v1=<hmac>
  if (!signatureHeader) return false
  const parts = Object.fromEntries(
    signatureHeader.split(',').map((p) => p.split('='))
  )
  const t = parts['t']
  const v1 = parts['v1']
  if (!t || !v1) return false

  const toSign = `${t}.${rawBody.toString('utf8')}`
  const expected = crypto
    .createHmac('sha256', signingKey)
    .update(toSign)
    .digest('hex')

  return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(v1, 'hex'))
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const signingKey = process.env.CALENDLY_WEBHOOK_SIGNING_KEY
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    return res.status(500).json({ error: 'Server not configured' })
  }

  let rawBody
  try {
    rawBody = await getRawBody(req)
  } catch {
    return res.status(400).json({ error: 'Failed to read request body' })
  }

  // Verify signature when a signing key is configured
  if (signingKey) {
    const sigHeader = req.headers['calendly-webhook-signature']
    if (!verifyCalendlySignature(rawBody, signingKey, sigHeader)) {
      console.error('[Calendly webhook] Signature verification failed')
      return res.status(400).json({ error: 'Invalid webhook signature' })
    }
  }

  let payload
  try {
    payload = JSON.parse(rawBody.toString('utf8'))
  } catch {
    return res.status(400).json({ error: 'Invalid JSON body' })
  }

  const event = payload?.event
  const eventData = payload?.payload

  if (!event || !eventData) {
    return res.status(400).json({ error: 'Missing event or payload' })
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const inviteeEmail = eventData?.email || eventData?.invitee?.email || null
  const inviteeName = eventData?.name || eventData?.invitee?.name || null
  const startTime = eventData?.event?.start_time || eventData?.scheduled_event?.start_time || null
  const endTime = eventData?.event?.end_time || eventData?.scheduled_event?.end_time || null
  const joinUrl = eventData?.event?.location?.join_url || null
  const eventTypeName = eventData?.event_type?.name || eventData?.scheduled_event?.name || null

  // Extract Calendly UUIDs from the resource URIs
  const eventUri = eventData?.event?.uri || eventData?.scheduled_event?.uri || ''
  const inviteeUri = eventData?.uri || ''
  const eventUuid = eventUri.split('/').pop() || null
  const inviteeUuid = inviteeUri.split('/').pop() || null

  if (!startTime) {
    return res.status(400).json({ error: 'Missing start_time in payload' })
  }

  // Resolve which client this booking belongs to by matching their email
  let clientId = null
  if (inviteeEmail) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('client_id')
      .ilike('email', inviteeEmail)
      .maybeSingle()

    if (profile?.client_id) {
      clientId = profile.client_id
    } else {
      // Fall back to direct match on clients.contact_email
      const { data: client } = await supabase
        .from('clients')
        .select('id')
        .ilike('contact_email', inviteeEmail)
        .maybeSingle()
      clientId = client?.id || null
    }
  }

  try {
    if (event === 'invitee.created') {
      await supabase.from('meetings').upsert(
        {
          client_id: clientId,
          calendly_event_uuid: eventUuid,
          calendly_invitee_uuid: inviteeUuid,
          event_type_name: eventTypeName || 'Meeting',
          invitee_name: inviteeName,
          invitee_email: inviteeEmail,
          start_time: startTime,
          end_time: endTime,
          join_url: joinUrl,
          status: 'active',
        },
        { onConflict: 'calendly_event_uuid' }
      )
      console.log(`[Calendly] Booking stored for ${inviteeEmail} at ${startTime}`)
    }

    if (event === 'invitee.canceled') {
      await supabase
        .from('meetings')
        .update({ status: 'canceled' })
        .eq('calendly_event_uuid', eventUuid)
      console.log(`[Calendly] Booking canceled: ${eventUuid}`)
    }

    return res.status(200).json({ ok: true })
  } catch (err) {
    console.error('[Calendly webhook] Error writing to Supabase:', err.message)
    return res.status(500).json({ error: err.message })
  }
}
