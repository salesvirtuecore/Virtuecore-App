import { createClient } from '@supabase/supabase-js'

function normalizeEmail(email) {
  if (!email || typeof email !== 'string') return null
  const lower = email.trim().toLowerCase()
  const at = lower.indexOf('@')
  if (at === -1) return lower
  const local = lower.slice(0, at)
  const domain = lower.slice(at + 1)

  if ((domain === 'gmail.com' || domain === 'googlemail.com') && local.includes('+')) {
    return `${local.split('+')[0]}@${domain}`
  }

  return lower
}

async function findClientForUser({ supabase, user, profile }) {
  if (profile?.client_id) {
    const { data } = await supabase
      .from('clients')
      .select('id, status, onboarding_started_at, contact_email, contact_name')
      .eq('id', profile.client_id)
      .maybeSingle()

    if (data) return data
  }

  const normalizedEmail = normalizeEmail(user.email)
  const emailCandidates = [...new Set([user.email, profile?.email, normalizedEmail].filter(Boolean))]

  for (const candidateEmail of emailCandidates) {
    const { data } = await supabase
      .from('clients')
      .select('id, status, onboarding_started_at, contact_email, contact_name')
      .ilike('contact_email', candidateEmail)
      .maybeSingle()

    if (data) return data
  }

  if (user?.user_metadata?.full_name) {
    const { data } = await supabase
      .from('clients')
      .select('id, status, onboarding_started_at, contact_email, contact_name')
      .ilike('contact_name', user.user_metadata.full_name)
      .maybeSingle()

    if (data) return data
  }

  return null
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    return res.status(500).json({ error: 'Server not configured' })
  }

  const authHeader = req.headers.authorization || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null

  if (!token) {
    return res.status(401).json({ error: 'Missing auth token' })
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  try {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token)

    if (userError || !user) {
      return res.status(401).json({ error: userError?.message || 'Invalid auth token' })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, role, client_id, email, full_name')
      .eq('id', user.id)
      .maybeSingle()

    const effectiveRole = profile?.role || user?.user_metadata?.role || 'client'
    if (effectiveRole !== 'client') {
      return res.status(200).json({ skipped: true })
    }

    const client = await findClientForUser({ supabase, user, profile })
    if (!client) {
      return res.status(200).json({ linked: false })
    }

    await supabase
      .from('profiles')
      .update({
        client_id: client.id,
        email: user.email,
        full_name: profile?.full_name || user?.user_metadata?.full_name || profile?.full_name || '',
      })
      .eq('id', user.id)

    const clientUpdates = {
      contact_email: client.contact_email || user.email,
      contact_name: client.contact_name || user?.user_metadata?.full_name || profile?.full_name || null,
      onboarding_started_at: client.onboarding_started_at || new Date().toISOString(),
    }

    if (client.status === 'onboarding') {
      clientUpdates.status = 'active'
    }

    await supabase
      .from('clients')
      .update(clientUpdates)
      .eq('id', client.id)

    return res.status(200).json({
      linked: true,
      clientId: client.id,
      status: clientUpdates.status || client.status,
      profile: {
        client_id: client.id,
        email: user.email,
        full_name: profile?.full_name || user?.user_metadata?.full_name || '',
      },
    })
  } catch (error) {
    console.error('[Client Claim] Failed to sync invited client:', error)
    return res.status(500).json({ error: error.message || 'Failed to sync invited client' })
  }
}