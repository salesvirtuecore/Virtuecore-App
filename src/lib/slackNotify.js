const SLACK_TOKEN = import.meta.env.VITE_SLACK_BOT_TOKEN
const SLACK_CHANNEL = import.meta.env.VITE_SLACK_CHANNEL_ID || 'D0APY47HZ25'

const EMOJI = {
  new_lead: '🎯',
  task_updated: '✅',
  task_created: '📋',
  invoice_created: '🧾',
  invoice_paid: '💰',
  deliverable_approved: '✅',
  deliverable_changes: '✏️',
  client_created: '🏢',
}

const MESSAGES = {
  new_lead: (d) => ({
    title: `${EMOJI.new_lead} New Lead`,
    text: `*${d.name}*${d.company ? ` · ${d.company}` : ''}\nSource: ${d.source || 'Unknown'} · Score: ${d.score ?? '—'} · Stage: ${d.stage || 'New'}`,
  }),
  task_updated: (d) => ({
    title: `${EMOJI.task_updated} Task ${d.status === 'complete' ? 'Completed' : 'Updated'}`,
    text: `*${d.title}*${d.client_name ? ` — ${d.client_name}` : ''}\nStatus: ${d.status.replace('_', ' ')}`,
  }),
  task_created: (d) => ({
    title: `${EMOJI.task_created} Task Assigned`,
    text: `*${d.title}*${d.client_name ? ` — ${d.client_name}` : ''}\nAssigned to: ${d.va_name || 'VA'} · Priority: ${d.priority || 'normal'}`,
  }),
  invoice_created: (d) => ({
    title: `${EMOJI.invoice_created} Invoice Created`,
    text: `*£${Number(d.amount).toLocaleString()}* ${d.type || ''} invoice\nClient: ${d.client_name || '—'} · Due: ${d.due_date || '—'}`,
  }),
  invoice_paid: (d) => ({
    title: `${EMOJI.invoice_paid} Invoice Paid`,
    text: `*£${Number(d.amount).toLocaleString()}* received\nStripe invoice: ${d.stripe_id || '—'}`,
  }),
  deliverable_approved: (d) => ({
    title: `${EMOJI.deliverable_approved} Deliverable Approved`,
    text: `*${d.title}*\nApproved by: ${d.client_name || 'Client'}`,
  }),
  deliverable_changes: (d) => ({
    title: `${EMOJI.deliverable_changes} Changes Requested`,
    text: `*${d.title}*\nFeedback from ${d.client_name || 'Client'}: ${d.feedback}`,
  }),
  client_created: (d) => ({
    title: `${EMOJI.client_created} New Client Onboarded`,
    text: `*${d.company_name || d.full_name}*\nEmail: ${d.email} · Package: ${d.package_tier || 'Starter'}`,
  }),
}

/**
 * Send a Slack notification for a VirtueCore event.
 * Silently no-ops if token is not configured.
 *
 * @param {'new_lead'|'task_updated'|'task_created'|'invoice_created'|'invoice_paid'|'deliverable_approved'|'deliverable_changes'|'client_created'} event
 * @param {object} data - Event-specific data
 */
export async function notifySlack(event, data) {
  if (!SLACK_TOKEN) return

  const builder = MESSAGES[event]
  if (!builder) return

  const { title, text } = builder(data)

  try {
    await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SLACK_TOKEN}`,
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify({
        channel: SLACK_CHANNEL,
        text: title,
        blocks: [
          {
            type: 'section',
            text: { type: 'mrkdwn', text: `*${title}*\n${text}` },
          },
          {
            type: 'context',
            elements: [{ type: 'mrkdwn', text: new Date().toUTCString() }],
          },
        ],
      }),
    })
  } catch {
    // Never let Slack errors bubble up and break user-facing actions
  }
}
