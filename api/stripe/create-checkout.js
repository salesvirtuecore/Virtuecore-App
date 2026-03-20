import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { invoice_id } = req.body ?? {}
  if (!invoice_id) {
    return res.status(400).json({ error: 'invoice_id is required' })
  }

  const stripeSecret = process.env.STRIPE_SECRET_KEY
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const appUrl = process.env.APP_URL || 'https://virtuecore-app.vercel.app'

  if (!stripeSecret || !supabaseUrl || !serviceRoleKey) {
    return res.status(500).json({ error: 'Server not configured' })
  }

  const stripe = new Stripe(stripeSecret, { apiVersion: '2024-04-10' })
  const supabase = createClient(supabaseUrl, serviceRoleKey)

  try {
    const { data: invoice, error } = await supabase
      .from('invoices')
      .select('*, clients(contact_email, company_name)')
      .eq('id', invoice_id)
      .single()

    if (error || !invoice) {
      return res.status(404).json({ error: 'Invoice not found' })
    }
    if (invoice.status === 'paid') {
      return res.status(400).json({ error: 'Invoice already paid' })
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      customer_email: invoice.clients?.contact_email ?? undefined,
      line_items: [
        {
          price_data: {
            currency: 'gbp',
            product_data: {
              name: `VirtueCore ${invoice.type ?? 'Invoice'} — ${invoice.clients?.company_name ?? ''}`.trim(),
              description: invoice.due_date ? `Due: ${invoice.due_date}` : undefined,
            },
            unit_amount: Math.round(Number(invoice.amount) * 100),
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${appUrl}/client/invoices?paid=true`,
      cancel_url: `${appUrl}/client/invoices`,
      metadata: { invoice_id },
    })

    return res.status(200).json({ url: session.url })
  } catch (err) {
    console.error('[create-checkout] error:', err)
    return res.status(500).json({ error: err.message ?? 'Checkout creation failed' })
  }
}
