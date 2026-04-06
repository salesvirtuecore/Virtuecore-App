/**
 * Send a Slack notification for a VirtueCore event via server-side proxy.
 * Silently no-ops on failure.
 *
 * @param {'new_lead'|'task_updated'|'task_created'|'invoice_created'|'invoice_paid'|'deliverable_approved'|'deliverable_changes'|'client_created'} event
 * @param {object} data - Event-specific data
 */
import { apiFetch } from './api'

export async function notifySlack(event, data) {
  try {
    await apiFetch('/api/slack/notify', {
      method: 'POST',
      body: JSON.stringify({ event, data }),
    })
  } catch {
    // Never let Slack errors bubble up and break user-facing actions
  }
}
