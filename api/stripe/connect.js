import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const stripeSecret = process.env.STRIPE_SECRET_KEY
  const stripeClientId = process.env.STRIPE_CLIENT_ID
  const returnUrl = process.env.STRIPE_CONNECT_RETURN_URL || 'https://virtuecore-app.vercel.app/admin/clients'
  const refreshUrl = process.env.STRIPE_CONNECT_REFRESH_URL || 'https://virtuecore-app.vercel.app/admin/clients'

  if (!supabaseUrl || !serviceRoleKey || !stripeSecret || !stripeClientId) {
    return res.status(500).json({ error: 'Server not configured' })
  }

  const { client_id, contact_email } = req.body
  if (!client_id || !contact_email) {
    return res.status(400).json({ error: 'client_id and contact_email are required' })
  }

  const stripe = new Stripe(stripeSecret, { apiVersion: '2024-04-10' })
  const supabase = createClient(supabaseUrl, serviceRoleKey)

  try {
    // Create a Stripe Express account
    const account = await stripe.accounts.create({
      type: 'express',
      country: 'GB',
      email: contact_email,
      business_type: 'company',
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
    })

    if (!account || !account.id) {
      throw new Error('Failed to create Stripe account')
    }

    // Save the connected account ID to client record
    const { error: updateError } = await supabase
      .from('clients')
      .update({ stripe_account_id: account.id })
      .eq('id', client_id)

    if (updateError) throw updateError

    // Generate onboarding link
    const link = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: 'account_onboarding',
    })

    return res.status(200).json({ connectUrl: link.url, stripeAccountId: account.id })
  } catch (err) {
    console.error('Stripe connect error:', err)
    return res.status(500).json({ error: err.message || 'Stripe connect failed' })
  }
}
