import { createClient } from '@supabase/supabase-js'

// ── Shared Supabase client (service role) ────────────────────────────────────
export function makeSupabase() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Server not configured')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

// ── Rate limiting (in-memory, per-IP) ────────────────────────────────────────
const rateLimitMap = new Map()
const RATE_LIMIT_WINDOW = 60_000 // 1 minute
const RATE_LIMIT_MAX = 60 // 60 requests per minute per IP

export function checkRateLimit(req, res) {
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown'
  const now = Date.now()
  const entry = rateLimitMap.get(ip)

  if (!entry || now - entry.start > RATE_LIMIT_WINDOW) {
    rateLimitMap.set(ip, { start: now, count: 1 })
    return true
  }

  entry.count++
  if (entry.count > RATE_LIMIT_MAX) {
    res.status(429).json({ error: 'Too many requests. Please try again later.' })
    return false
  }
  return true
}

// Periodically clean up old entries (every 5 minutes)
setInterval(() => {
  const cutoff = Date.now() - RATE_LIMIT_WINDOW * 2
  for (const [ip, entry] of rateLimitMap) {
    if (entry.start < cutoff) rateLimitMap.delete(ip)
  }
}, 300_000)

// ── Authenticate user from Bearer token ──────────────────────────────────────
// Returns { user, profile } or sends 401 and returns null
export async function authenticateUser(req, res) {
  const token = (req.headers.authorization || '').replace('Bearer ', '').trim()
  if (!token) {
    res.status(401).json({ error: 'Authentication required' })
    return null
  }

  const supabase = makeSupabase()
  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) {
    res.status(401).json({ error: 'Invalid or expired token' })
    return null
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email, full_name, role, client_id')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile) {
    res.status(403).json({ error: 'No profile found for this account' })
    return null
  }

  return { user, profile, supabase }
}

// ── Require specific role(s) ─────────────────────────────────────────────────
// Call after authenticateUser. Returns true if allowed, false if denied.
export function requireRole(res, profile, ...roles) {
  if (!roles.includes(profile.role)) {
    res.status(403).json({ error: 'You do not have permission to perform this action' })
    return false
  }
  return true
}

// ── Verify client owns the resource ──────────────────────────────────────────
export function requireClientOwnership(res, profile, clientId) {
  if (profile.role === 'admin') return true
  if (profile.client_id === clientId) return true
  res.status(403).json({ error: 'You do not have access to this resource' })
  return false
}
