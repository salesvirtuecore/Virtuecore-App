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

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const token = process.env.SLACK_BOT_TOKEN
  const channel = process.env.SLACK_CHANNEL_ID || 'D0APY47HZ25'
  if (!token) return res.status(200).json({ ok: false, reason: 'Slack not configured' })

  const { event, data } = req.body
  if (!data || typeof data !== 'object') return res.status(400).json({ error: 'Missing data' })
  const builder = MESSAGES[event]
  if (!builder) return res.status(400).json({ error: 'Unknown event' })

  const { title, text } = builder(data)

  try {
    const slackRes = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify({
        channel,
        text: title,
        blocks: [
          { type: 'section', text: { type: 'mrkdwn', text: `*${title}*\n${text}` } },
          { type: 'context', elements: [{ type: 'mrkdwn', text: new Date().toUTCString() }] },
        ],
      }),
    })
    const slackData = await slackRes.json()
    res.status(200).json({ ok: slackData.ok, error: slackData.error || undefined })
  } catch {
    res.status(200).json({ ok: false, reason: 'Slack API error' })
  }
}
