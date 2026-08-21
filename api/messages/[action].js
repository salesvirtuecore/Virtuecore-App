import { authenticateUser, requireClientOwnership, checkRateLimit } from '../_lib/auth.js'
import { sendMessageReplyEmail, sendStaffMessageAlertEmail } from '../_lib/email.js'

// ── notify (POST) ─────────────────────────────────────────────────────────
// Fired right after a portal message is inserted (by either Messages.jsx or
// admin ClientView.jsx) — this is a best-effort side channel alongside the
// existing push notification, not the message send itself. A failure here
// never undoes the message; it just means the extra email/Slack ping didn't
// go out.
//   - Staff (admin) sends -> client gets an email reply notification.
//   - Client sends -> every admin gets an email alert, plus a Slack ping if
//     SLACK_BOT_TOKEN is configured.
async function handleNotify(req, res, profile, supabase) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const { client_id, content } = req.body ?? {}
  if (!client_id || !content) return res.status(400).json({ error: 'client_id and content required' })
  if (!requireClientOwnership(res, profile, client_id)) return

  const { data: client } = await supabase.from('clients')
    .select('id, company_name, contact_name, contact_email')
    .eq('id', client_id).maybeSingle()
  if (!client) return res.status(404).json({ error: 'Client not found' })

  if (profile.role === 'admin' || profile.role === 'va') {
    try {
      await sendMessageReplyEmail({
        email: client.contact_email,
        fullName: client.contact_name,
        senderName: profile.full_name,
        preview: content,
      })
    } catch {
      // Best effort — the message itself already sent successfully.
    }
    return res.status(200).json({ ok: true })
  }

  if (profile.role === 'client') {
    const { data: admins } = await supabase.from('profiles').select('email, full_name').eq('role', 'admin')
    await Promise.all((admins || []).map((admin) =>
      sendStaffMessageAlertEmail({
        email: admin.email,
        clientName: client.company_name,
        senderName: profile.full_name,
        preview: content,
        clientId: client_id,
      }).catch(() => {})
    ))

    const slackToken = process.env.SLACK_BOT_TOKEN
    if (slackToken) {
      try {
        await fetch('https://slack.com/api/chat.postMessage', {
          method: 'POST',
          headers: { Authorization: `Bearer ${slackToken}`, 'Content-Type': 'application/json; charset=utf-8' },
          body: JSON.stringify({
            channel: process.env.SLACK_CHANNEL_ID || 'D0APY47HZ25',
            text: `New portal message from ${client.company_name}`,
            blocks: [{
              type: 'section',
              text: { type: 'mrkdwn', text: `*New portal message* from *${profile.full_name || 'a client'}* (${client.company_name})\n> ${content.slice(0, 300)}` },
            }],
          }),
        })
      } catch {
        // Best effort
      }
    }
    return res.status(200).json({ ok: true })
  }

  return res.status(403).json({ error: 'Forbidden' })
}

export default async function handler(req, res) {
  if (!checkRateLimit(req, res)) return
  const auth = await authenticateUser(req, res)
  if (!auth) return
  const action = req.query.action
  if (action === 'notify') return handleNotify(req, res, auth.profile, auth.supabase)
  res.status(404).json({ error: 'Unknown action' })
}
