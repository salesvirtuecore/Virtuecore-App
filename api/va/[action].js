import { authenticateUser, requireRole, checkRateLimit } from '../_lib/auth.js'

// ── submit (POST) — VA requests payment for an amount owed ─────────────────
async function handleSubmit(req, res, profile, supabase) {
  if (!requireRole(res, profile, 'va')) return
  const { amount, note } = req.body ?? {}
  const parsedAmount = Number(amount)
  if (!parsedAmount || parsedAmount <= 0) return res.status(400).json({ error: 'amount must be a positive number' })

  const { error } = await supabase.from('va_invoices').insert({
    va_id: profile.id,
    amount: parsedAmount,
    note: note || null,
  })
  if (error) return res.status(500).json({ error: error.message })
  res.status(200).json({ ok: true })
}

// ── my-invoices (GET) — VA's own submission history ─────────────────────────
async function handleMyInvoices(req, res, profile, supabase) {
  if (!requireRole(res, profile, 'va')) return
  const { data, error } = await supabase.from('va_invoices')
    .select('id, amount, note, status, admin_note, paid_at, created_at')
    .eq('va_id', profile.id)
    .order('created_at', { ascending: false })
  if (error) return res.status(500).json({ error: error.message })
  res.status(200).json({ invoices: data || [] })
}

// ── list-all (GET) — admin queue ────────────────────────────────────────────
async function handleListAll(req, res, profile, supabase) {
  if (!requireRole(res, profile, 'admin')) return
  const { data, error } = await supabase.from('va_invoices')
    .select('id, va_id, amount, note, status, admin_note, paid_at, created_at, profiles!va_invoices_va_id_fkey(full_name, email)')
    .order('created_at', { ascending: false })
  if (error) return res.status(500).json({ error: error.message })
  res.status(200).json({ invoices: data || [] })
}

// ── update-status (POST) — admin approves/rejects/marks paid ───────────────
async function handleUpdateStatus(req, res, profile, supabase) {
  if (!requireRole(res, profile, 'admin')) return
  const { invoice_id, status, admin_note } = req.body ?? {}
  if (!invoice_id || !['approved', 'paid', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'invoice_id and a valid status are required' })
  }
  const updates = {
    status,
    admin_note: admin_note || null,
    reviewed_by: profile.id,
    reviewed_at: new Date().toISOString(),
  }
  if (status === 'paid') updates.paid_at = new Date().toISOString()

  const { error } = await supabase.from('va_invoices').update(updates).eq('id', invoice_id)
  if (error) return res.status(500).json({ error: error.message })
  res.status(200).json({ ok: true })
}

// ── Router ─────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (!checkRateLimit(req, res)) return
  const auth = await authenticateUser(req, res)
  if (!auth) return
  const { profile, supabase } = auth
  const action = req.query.action

  if (action === 'submit') return handleSubmit(req, res, profile, supabase)
  if (action === 'my-invoices') return handleMyInvoices(req, res, profile, supabase)
  if (action === 'list-all') return handleListAll(req, res, profile, supabase)
  if (action === 'update-status') return handleUpdateStatus(req, res, profile, supabase)
  res.status(404).json({ error: 'Unknown action' })
}
