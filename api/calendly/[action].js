import crypto from 'crypto'
import { authenticateUser, requireRole, requireClientOwnership, makeSupabase, getAppUrl } from '../_lib/auth.js'
import { encryptSecret, decryptSecret } from '../_lib/crypto.js'

const CALENDLY_API = 'https://api.calendly.com'

// Safe to return to the browser — never the real key. Calendly PATs have no
// stable prefix to preserve (unlike Stripe's sk_/rk_), so just show the tail.
function maskCalendlyKey(plaintext) {
  if (!plaintext) return null
  return `••••${plaintext.slice(-4)}`
}

async function calendlyRequest(path, { method = 'GET', token, body } = {}) {
  const res = await fetch(path.startsWith('http') ? path : `${CALENDLY_API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const message = data?.message || data?.title || `Calendly API error (${res.status})`
    throw Object.assign(new Error(message), { status: res.status })
  }
  return data
}

// ── /api/calendly/status (GET) ───────────────────────────────────────────────
async function handleStatus(req, res, authProfile) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  const targetClientId = authProfile.role === 'admin' ? req.query.client_id : authProfile.client_id
  if (!targetClientId) return res.status(400).json({ error: 'client_id required' })
  if (!requireClientOwnership(res, authProfile, targetClientId)) return

  const supabase = makeSupabase()
  const { data: client, error } = await supabase.from('clients')
    .select('id, calendly_api_key_masked, calendly_connected_at, calendly_user_uri')
    .eq('id', targetClientId).maybeSingle()
  if (error) return res.status(500).json({ error: error.message })
  if (!client) return res.status(404).json({ error: 'Client not found' })

  return res.status(200).json({
    connected: Boolean(client.calendly_connected_at),
    calendlyKeyMasked: client.calendly_api_key_masked || null,
    connectedAt: client.calendly_connected_at,
  })
}

// ── /api/calendly/save-api-key (POST) ───────────────────────────────────────
// Client (or admin, on their behalf) pastes their own Calendly Personal
// Access Token. We validate it, then USE it once to create a webhook
// subscription pointed at our per-client route — so no manual webhook setup
// in Calendly's own dashboard is ever needed.
async function handleSaveApiKey(req, res, authProfile) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!requireRole(res, authProfile, 'client', 'admin')) return

  const { api_key } = req.body ?? {}
  const targetClientId = authProfile.role === 'admin' ? req.body?.client_id : authProfile.client_id
  if (!targetClientId) return res.status(400).json({ error: 'client_id required' })
  if (!requireClientOwnership(res, authProfile, targetClientId)) return

  if (!api_key || typeof api_key !== 'string' || api_key.trim().length < 20) {
    return res.status(400).json({ error: "That doesn't look like a valid Calendly API key" })
  }
  const key = api_key.trim()

  let me
  try {
    me = await calendlyRequest('/users/me', { token: key })
  } catch (err) {
    return res.status(400).json({ error: `Calendly rejected this key: ${err.message}` })
  }
  const userUri = me?.resource?.uri
  const organizationUri = me?.resource?.current_organization
  if (!userUri || !organizationUri) {
    return res.status(400).json({ error: 'Calendly did not return a valid user/organization for this key' })
  }

  const supabase = makeSupabase()

  // Reconnecting: remove the old webhook subscription first so we don't
  // leave an orphaned one live on the client's Calendly account.
  const { data: existing } = await supabase.from('clients')
    .select('calendly_webhook_subscription_uri, calendly_api_key_encrypted').eq('id', targetClientId).maybeSingle()
  if (existing?.calendly_webhook_subscription_uri) {
    try {
      const oldKey = existing.calendly_api_key_encrypted ? decryptSecret(existing.calendly_api_key_encrypted) : key
      await calendlyRequest(existing.calendly_webhook_subscription_uri, { method: 'DELETE', token: oldKey })
    } catch {
      // Best effort — the old subscription may already be gone (e.g. deleted
      // directly in Calendly), don't block reconnecting over this.
    }
  }

  const signingKey = crypto.randomBytes(32).toString('hex')
  const webhookUrl = `${getAppUrl()}/api/webhooks/calendly/${targetClientId}`
  let subscription
  try {
    subscription = await calendlyRequest('/webhook_subscriptions', {
      method: 'POST',
      token: key,
      body: {
        url: webhookUrl,
        events: ['invitee.created', 'invitee.canceled'],
        organization: organizationUri,
        user: userUri,
        scope: 'user',
        signing_key: signingKey,
      },
    })
  } catch (err) {
    return res.status(400).json({ error: `Couldn't create the Calendly webhook: ${err.message}` })
  }

  const { error: updateError } = await supabase.from('clients').update({
    calendly_api_key_encrypted: encryptSecret(key),
    calendly_api_key_masked: maskCalendlyKey(key),
    calendly_webhook_signing_key_encrypted: encryptSecret(signingKey),
    calendly_webhook_subscription_uri: subscription?.resource?.uri || null,
    calendly_organization_uri: organizationUri,
    calendly_user_uri: userUri,
    calendly_connected_at: new Date().toISOString(),
  }).eq('id', targetClientId)
  if (updateError) return res.status(500).json({ error: updateError.message })

  return res.status(200).json({ ok: true, masked: maskCalendlyKey(key) })
}

// ── Router ───────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  const auth = await authenticateUser(req, res)
  if (!auth) return

  const action = req.query.action
  if (action === 'status') return handleStatus(req, res, auth.profile)
  if (action === 'save-api-key') return handleSaveApiKey(req, res, auth.profile)
  res.status(404).json({ error: 'Unknown action' })
}
