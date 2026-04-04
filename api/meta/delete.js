import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

// Facebook Data Deletion Callback
// Required by Meta for apps using Facebook Login
// Docs: https://developers.facebook.com/docs/development/create-an-app/app-dashboard/data-deletion-callback
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  try {
    const { signed_request } = req.body
    if (!signed_request) return res.status(400).json({ error: 'Missing signed_request' })

    const appSecret = process.env.META_APP_SECRET || process.env.META_ADS_APP_SECRET
    if (!appSecret) return res.status(500).json({ error: 'Server not configured' })

    // Decode and verify the signed request from Facebook
    const [encodedSig, payload] = signed_request.split('.')
    const data = JSON.parse(Buffer.from(payload, 'base64').toString('utf8'))

    const expectedSig = crypto
      .createHmac('sha256', appSecret)
      .update(payload)
      .digest('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '')

    if (encodedSig !== expectedSig) {
      return res.status(400).json({ error: 'Invalid signature' })
    }

    const facebookUserId = data.user_id
    const confirmationCode = crypto.randomBytes(8).toString('hex')

    // Remove any stored Meta tokens for this Facebook user
    try {
      const supabase = createClient(
        process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { autoRefreshToken: false, persistSession: false } }
      )
      // Clear Meta tokens from any client linked to this Facebook user
      await supabase
        .from('clients')
        .update({ meta_access_token: null, meta_token_expires_at: null, meta_ad_account_id: null })
        .eq('facebook_user_id', facebookUserId)
    } catch (_) {
      // Best effort — don't block the response
    }

    const appUrl = process.env.VITE_APP_URL || 'https://app.virtuecore.co.uk'

    // Facebook requires this exact response format
    return res.status(200).json({
      url: `${appUrl}/deletion-status?code=${confirmationCode}`,
      confirmation_code: confirmationCode,
    })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
