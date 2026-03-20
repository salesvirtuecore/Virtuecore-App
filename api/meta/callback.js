// Handles the Facebook OAuth callback.
// Exchanges the code for a long-lived token, fetches the user's ad accounts,
// stores the token on the client record, and returns available ad accounts.
// Required env vars: META_APP_ID, META_APP_SECRET, VITE_APP_URL,
//                    VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { META_APP_ID, META_APP_SECRET, VITE_APP_URL } = process.env
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!META_APP_ID || !META_APP_SECRET || !VITE_APP_URL || !supabaseUrl || !serviceRoleKey) {
    return res.status(500).json({ error: 'Server not configured' })
  }

  const { code, client_id } = req.body
  if (!code || !client_id) return res.status(400).json({ error: 'Missing code or client_id' })

  const redirectUri = `${VITE_APP_URL}/meta/callback`

  // ── Step 1: Exchange code for short-lived token ───────────────────────────
  const tokenUrl = new URL('https://graph.facebook.com/v19.0/oauth/access_token')
  tokenUrl.searchParams.set('client_id', META_APP_ID)
  tokenUrl.searchParams.set('client_secret', META_APP_SECRET)
  tokenUrl.searchParams.set('redirect_uri', redirectUri)
  tokenUrl.searchParams.set('code', code)

  const tokenRes = await fetch(tokenUrl.toString())
  const tokenData = await tokenRes.json()
  if (!tokenRes.ok || !tokenData.access_token) {
    return res.status(400).json({ error: 'Failed to exchange code', detail: tokenData })
  }

  // ── Step 2: Exchange short-lived for long-lived token (60 days) ──────────
  const longLivedUrl = new URL('https://graph.facebook.com/v19.0/oauth/access_token')
  longLivedUrl.searchParams.set('grant_type', 'fb_exchange_token')
  longLivedUrl.searchParams.set('client_id', META_APP_ID)
  longLivedUrl.searchParams.set('client_secret', META_APP_SECRET)
  longLivedUrl.searchParams.set('fb_exchange_token', tokenData.access_token)

  const longLivedRes = await fetch(longLivedUrl.toString())
  const longLivedData = await longLivedRes.json()
  const accessToken = longLivedData.access_token || tokenData.access_token
  const expiresIn = longLivedData.expires_in || 3600
  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString()

  // ── Step 3: Fetch user's ad accounts ─────────────────────────────────────
  const accountsUrl = new URL('https://graph.facebook.com/v19.0/me/adaccounts')
  accountsUrl.searchParams.set('fields', 'name,account_id,account_status,currency')
  accountsUrl.searchParams.set('access_token', accessToken)

  const accountsRes = await fetch(accountsUrl.toString())
  const accountsData = await accountsRes.json()
  const accounts = (accountsData.data || []).map((a) => ({
    id: a.id,           // act_XXXXXXXXX
    account_id: a.account_id,
    name: a.name,
    status: a.account_status,
    currency: a.currency,
  }))

  // ── Step 4: Store token on client record ──────────────────────────────────
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { error: updateError } = await supabase
    .from('clients')
    .update({
      meta_access_token: accessToken,
      meta_token_expires_at: expiresAt,
    })
    .eq('id', client_id)

  if (updateError) {
    return res.status(500).json({ error: 'Failed to save token', detail: updateError.message })
  }

  res.status(200).json({ accounts, expires_at: expiresAt })
}
