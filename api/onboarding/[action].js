import { authenticateUser, requireRole, requireClientOwnership, checkRateLimit } from '../_lib/auth.js'
import { ONBOARDING_STEPS } from '../../src/data/onboardingSteps.js'

const STEP_IDS = new Set(ONBOARDING_STEPS.map((s) => s.id))

function resolveTargetClientId(req, profile) {
  return profile.role === 'admin' ? req.query.client_id || req.body?.client_id : profile.client_id
}

// ── get-progress (GET) ──────────────────────────────────────────────────────
async function handleGetProgress(req, res, profile, supabase) {
  const clientId = resolveTargetClientId(req, profile)
  if (!clientId) return res.status(400).json({ error: 'client_id required' })
  if (!requireClientOwnership(res, profile, clientId)) return

  const { data, error } = await supabase.from('client_onboarding_progress')
    .select('step_id, completed, completed_at')
    .eq('client_id', clientId)
  if (error) return res.status(500).json({ error: error.message })
  res.status(200).json({ progress: data || [] })
}

// ── mark-step (POST) ────────────────────────────────────────────────────────
async function handleMarkStep(req, res, profile, supabase) {
  if (!requireRole(res, profile, 'client')) return
  const { step_id, completed } = req.body ?? {}
  if (!STEP_IDS.has(step_id)) return res.status(400).json({ error: 'Unknown step_id' })
  if (!profile.client_id) return res.status(400).json({ error: 'No client linked to your account' })

  const { error } = await supabase.from('client_onboarding_progress').upsert({
    client_id: profile.client_id,
    step_id,
    completed: Boolean(completed),
    completed_at: completed ? new Date().toISOString() : null,
  }, { onConflict: 'client_id,step_id' })
  if (error) return res.status(500).json({ error: error.message })
  res.status(200).json({ ok: true })
}

// ── submit-credentials (POST) ───────────────────────────────────────────────
async function handleSubmitCredentials(req, res, profile, supabase) {
  if (!requireRole(res, profile, 'client')) return
  if (!profile.client_id) return res.status(400).json({ error: 'No client linked to your account' })
  const { doc_type, file_path, external_link, notes } = req.body ?? {}
  if (doc_type !== 'file' && doc_type !== 'google_doc_link') {
    return res.status(400).json({ error: 'doc_type must be "file" or "google_doc_link"' })
  }
  if (doc_type === 'file' && !file_path) return res.status(400).json({ error: 'file_path required for doc_type=file' })
  if (doc_type === 'google_doc_link' && !external_link) return res.status(400).json({ error: 'external_link required for doc_type=google_doc_link' })

  const { error } = await supabase.from('client_credentials').insert({
    client_id: profile.client_id,
    doc_type,
    file_path: file_path || null,
    external_link: external_link || null,
    notes: notes || null,
    submitted_by: profile.id,
  })
  if (error) return res.status(500).json({ error: error.message })

  await supabase.from('client_onboarding_progress').upsert({
    client_id: profile.client_id,
    step_id: 'submit',
    completed: true,
    completed_at: new Date().toISOString(),
  }, { onConflict: 'client_id,step_id' })

  res.status(200).json({ ok: true })
}

// ── submit-contract (POST) ──────────────────────────────────────────────────
async function handleSubmitContract(req, res, profile, supabase) {
  if (!requireRole(res, profile, 'client')) return
  if (!profile.client_id) return res.status(400).json({ error: 'No client linked to your account' })
  const { file_path, file_name } = req.body ?? {}
  if (!file_path) return res.status(400).json({ error: 'file_path required' })

  const { error } = await supabase.from('contracts').insert({
    client_id: profile.client_id,
    file_path,
    file_name: file_name || null,
    uploaded_by: profile.id,
  })
  if (error) return res.status(500).json({ error: error.message })
  res.status(200).json({ ok: true })
}

// ── admin-list-credentials (GET) ────────────────────────────────────────────
async function handleAdminListCredentials(req, res, profile, supabase) {
  if (!requireRole(res, profile, 'admin')) return
  const { data, error } = await supabase.from('client_credentials')
    .select('id, client_id, doc_type, file_path, external_link, notes, created_at, clients(company_name)')
    .order('created_at', { ascending: false })
  if (error) return res.status(500).json({ error: error.message })
  res.status(200).json({ credentials: data || [] })
}

// ── admin-list-contracts (GET) ──────────────────────────────────────────────
async function handleAdminListContracts(req, res, profile, supabase) {
  if (!requireRole(res, profile, 'admin')) return
  const { data, error } = await supabase.from('contracts')
    .select('id, client_id, file_path, file_name, status, created_at, clients(company_name)')
    .order('created_at', { ascending: false })
  if (error) return res.status(500).json({ error: error.message })
  res.status(200).json({ contracts: data || [] })
}

// ── Router ─────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (!checkRateLimit(req, res)) return
  const auth = await authenticateUser(req, res)
  if (!auth) return
  const { profile, supabase } = auth
  const action = req.query.action

  if (action === 'get-progress') return handleGetProgress(req, res, profile, supabase)
  if (action === 'mark-step') return handleMarkStep(req, res, profile, supabase)
  if (action === 'submit-credentials') return handleSubmitCredentials(req, res, profile, supabase)
  if (action === 'submit-contract') return handleSubmitContract(req, res, profile, supabase)
  if (action === 'admin-list-credentials') return handleAdminListCredentials(req, res, profile, supabase)
  if (action === 'admin-list-contracts') return handleAdminListContracts(req, res, profile, supabase)
  res.status(404).json({ error: 'Unknown action' })
}
