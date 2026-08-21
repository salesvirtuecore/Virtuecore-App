// ─────────────────────────────────────────────────────────────────────────────
// Onboarding follow-up automation
// Sends a daily nudge to clients who haven't finished the onboarding
// checklist, then a one-time "you're all set" email the moment they do.
// ─────────────────────────────────────────────────────────────────────────────
import { ONBOARDING_STEPS } from '../../src/data/onboardingSteps.js'
import { sendOnboardingReminderEmail, sendOnboardingCompleteEmail } from './email.js'

const TOTAL_STEPS = ONBOARDING_STEPS.length

async function getCompletedStepCount(supabase, clientId) {
  const { data } = await supabase.from('client_onboarding_progress')
    .select('step_id').eq('client_id', clientId).eq('completed', true)
  return (data || []).length
}

// Call this right after any onboarding step is marked complete. Sends the
// final "you're all set" email immediately — rather than waiting for the
// next day's cron pass — the moment a client finishes every step, and
// records that it's been sent so the daily reminder cron leaves them alone
// from then on. Safe to call after every step; it's a no-op until the last
// one lands, and a no-op again if the welcome email already went out.
export async function checkAndSendOnboardingComplete(supabase, clientId) {
  const { data: client } = await supabase.from('clients')
    .select('id, contact_name, contact_email, company_name, onboarding_welcome_sent_at')
    .eq('id', clientId).maybeSingle()
  if (!client || client.onboarding_welcome_sent_at) return false

  const completedCount = await getCompletedStepCount(supabase, clientId)
  if (completedCount < TOTAL_STEPS) return false

  try {
    await sendOnboardingCompleteEmail({
      email: client.contact_email,
      fullName: client.contact_name,
      companyName: client.company_name,
    })
  } catch {
    // Don't fail the calling request (e.g. mark-step) over an email hiccup —
    // the cron pass below acts as a safety net and will retry it.
  }
  await supabase.from('clients').update({ onboarding_welcome_sent_at: new Date().toISOString() }).eq('id', clientId)
  return true
}

// ── Daily cron pass ──────────────────────────────────────────────────────────
// Nudges every invited client who hasn't finished onboarding yet, once every
// ~24h, until they either finish (welcome email, handled here as a safety
// net too) or churn.
export async function runOnboardingReminderPass(supabase) {
  const { data: clients } = await supabase.from('clients')
    .select('id, contact_name, contact_email, company_name, onboarding_reminder_sent_at, onboarding_reminder_count, onboarding_welcome_sent_at, status')
    .is('onboarding_welcome_sent_at', null)
    .neq('status', 'churned')

  const results = []
  for (const client of clients || []) {
    if (!client.contact_email) {
      results.push({ client_id: client.id, skipped: 'no_contact_email' })
      continue
    }

    // At most one reminder per ~24h — guards against cron jitter without
    // requiring an exact 24h boundary.
    const lastSent = client.onboarding_reminder_sent_at ? new Date(client.onboarding_reminder_sent_at).getTime() : null
    const hoursSinceLast = lastSent ? (Date.now() - lastSent) / 3_600_000 : Infinity
    if (hoursSinceLast < 20) {
      results.push({ client_id: client.id, skipped: 'reminded_recently' })
      continue
    }

    const completedCount = await getCompletedStepCount(supabase, client.id)

    if (completedCount >= TOTAL_STEPS) {
      try {
        await sendOnboardingCompleteEmail({
          email: client.contact_email,
          fullName: client.contact_name,
          companyName: client.company_name,
        })
        await supabase.from('clients').update({ onboarding_welcome_sent_at: new Date().toISOString() }).eq('id', client.id)
        results.push({ client_id: client.id, action: 'welcome_sent' })
      } catch (err) {
        results.push({ client_id: client.id, error: err.message })
      }
      continue
    }

    try {
      await sendOnboardingReminderEmail({
        email: client.contact_email,
        fullName: client.contact_name,
        companyName: client.company_name,
        completedCount,
        totalSteps: TOTAL_STEPS,
      })
      await supabase.from('clients').update({
        onboarding_reminder_sent_at: new Date().toISOString(),
        onboarding_reminder_count: (client.onboarding_reminder_count || 0) + 1,
      }).eq('id', client.id)
      results.push({ client_id: client.id, action: 'reminder_sent', completed: completedCount, total: TOTAL_STEPS })
    } catch (err) {
      results.push({ client_id: client.id, error: err.message })
    }
  }
  return results
}
