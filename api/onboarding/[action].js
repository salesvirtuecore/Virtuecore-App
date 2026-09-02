import crypto from 'crypto'
import { authenticateUser, requireRole, requireClientOwnership, checkRateLimit } from '../_lib/auth.js'
import { ONBOARDING_STEPS } from '../../src/data/onboardingSteps.js'
import { sendWelcomeOnboardingEmail } from '../_lib/email.js'
import { checkAndSendOnboardingComplete } from '../_lib/onboarding.js'
import { encryptSecret, decryptSecret } from '../_lib/crypto.js'

const STEP_IDS = new Set(ONBOARDING_STEPS.map((s) => s.id))

function resolveTargetClientId(req, profile) {
  return profile.role === 'admin' ? req.query.client_id || req.body?.client_id : profile.client_id
}

// ── send-welcome-email (POST) — fired once right after a client's first signup ──
async function handleSendWelcomeEmail(req, res, profile) {
  if (!requireRole(res, profile, 'client')) return
  try {
    await sendWelcomeOnboardingEmail({ email: profile.email, fullName: profile.full_name })
  } catch {
    // Non-critical — signup should never fail because the welcome email didn't send.
  }
  res.status(200).json({ ok: true })
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

  if (completed) {
    try {
      await checkAndSendOnboardingComplete(supabase, profile.client_id)
    } catch {
      // Non-critical — don't fail the step update over an email hiccup.
    }
  }

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

  try {
    await checkAndSendOnboardingComplete(supabase, profile.client_id)
  } catch {
    // Non-critical — don't fail credential submission over an email hiccup.
  }

  res.status(200).json({ ok: true })
}

// ── submit-login-credentials (POST) — structured logins grouped by shared email/password ──
async function handleSubmitLoginCredentials(req, res, profile, supabase) {
  if (!requireRole(res, profile, 'client')) return
  if (!profile.client_id) return res.status(400).json({ error: 'No client linked to your account' })
  const { groups } = req.body ?? {}
  if (!Array.isArray(groups) || groups.length === 0) {
    return res.status(400).json({ error: 'At least one login is required' })
  }

  const rows = []
  for (const group of groups) {
    const email = String(group?.email || '').trim()
    const password = String(group?.password || '')
    const apps = Array.isArray(group?.apps) ? group.apps.map((a) => String(a).trim()).filter(Boolean) : []
    const notes = String(group?.notes || '').trim() || null
    if (!email || !password) return res.status(400).json({ error: 'Every login needs an email and password' })
    if (apps.length === 0) return res.status(400).json({ error: 'Every login needs at least one app selected' })

    const groupId = crypto.randomUUID()
    const loginPasswordEncrypted = encryptSecret(password)
    for (const app of apps) {
      rows.push({
        client_id: profile.client_id,
        group_id: groupId,
        app_name: app,
        login_email: email,
        login_password_encrypted: loginPasswordEncrypted,
        notes,
        submitted_by: profile.id,
      })
    }
  }

  const { error } = await supabase.from('client_login_credentials').insert(rows)
  if (error) return res.status(500).json({ error: error.message })

  await supabase.from('client_onboarding_progress').upsert({
    client_id: profile.client_id,
    step_id: 'submit',
    completed: true,
    completed_at: new Date().toISOString(),
  }, { onConflict: 'client_id,step_id' })

  try {
    await checkAndSendOnboardingComplete(supabase, profile.client_id)
  } catch {
    // Non-critical — don't fail credential submission over an email hiccup.
  }

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

// ── admin-list-login-credentials (GET) — passwords stay encrypted here, reveal is per-row ──
async function handleAdminListLoginCredentials(req, res, profile, supabase) {
  if (!requireRole(res, profile, 'admin')) return
  const { data, error } = await supabase.from('client_login_credentials')
    .select('id, client_id, group_id, app_name, login_email, notes, created_at, clients(company_name)')
    .order('group_id', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) return res.status(500).json({ error: error.message })
  res.status(200).json({ logins: data || [] })
}

// ── admin-reveal-login-password (POST) — decrypts one password on demand ────
async function handleAdminRevealLoginPassword(req, res, profile, supabase) {
  if (!requireRole(res, profile, 'admin')) return
  const { id } = req.body ?? {}
  if (!id) return res.status(400).json({ error: 'id required' })

  const { data, error } = await supabase.from('client_login_credentials')
    .select('login_password_encrypted')
    .eq('id', id)
    .single()
  if (error || !data) return res.status(404).json({ error: 'Not found' })

  try {
    res.status(200).json({ password: decryptSecret(data.login_password_encrypted) })
  } catch {
    res.status(500).json({ error: 'Could not decrypt password' })
  }
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

// ── update-contract-status (POST) — admin marks a contract signed/archived ──
const CONTRACT_STATUSES = new Set(['submitted', 'signed', 'archived'])
async function handleUpdateContractStatus(req, res, profile, supabase) {
  if (!requireRole(res, profile, 'admin')) return
  const { contract_id, status } = req.body ?? {}
  if (!contract_id || !CONTRACT_STATUSES.has(status)) {
    return res.status(400).json({ error: 'contract_id and a valid status are required' })
  }
  const { error } = await supabase.from('contracts').update({ status }).eq('id', contract_id)
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

  if (action === 'send-welcome-email') return handleSendWelcomeEmail(req, res, profile)
  if (action === 'get-progress') return handleGetProgress(req, res, profile, supabase)
  if (action === 'mark-step') return handleMarkStep(req, res, profile, supabase)
  if (action === 'submit-credentials') return handleSubmitCredentials(req, res, profile, supabase)
  if (action === 'submit-login-credentials') return handleSubmitLoginCredentials(req, res, profile, supabase)
  if (action === 'submit-contract') return handleSubmitContract(req, res, profile, supabase)
  if (action === 'admin-list-credentials') return handleAdminListCredentials(req, res, profile, supabase)
  if (action === 'admin-list-login-credentials') return handleAdminListLoginCredentials(req, res, profile, supabase)
  if (action === 'admin-reveal-login-password') return handleAdminRevealLoginPassword(req, res, profile, supabase)
  if (action === 'admin-list-contracts') return handleAdminListContracts(req, res, profile, supabase)
  if (action === 'update-contract-status') return handleUpdateContractStatus(req, res, profile, supabase)
  res.status(404).json({ error: 'Unknown action' })
}
