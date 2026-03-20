import Anthropic from '@anthropic-ai/sdk'

const APP_KNOWLEDGE = {
  admin: {
    primaryRoutes: ['/admin', '/admin/clients', '/admin/pipeline', '/admin/vas', '/admin/revenue', '/admin/webhooks'],
    notes: [
      'Clients page manages invites, onboarding, status, and Stripe connect actions.',
      'Revenue page manages invoice workflows and payment states.',
      'Pipeline tracks lead stages from captured to onboarding.',
      'Dashboard shows active/onboarding/joined status rollups.',
    ],
  },
  client: {
    primaryRoutes: ['/client', '/client/deliverables', '/client/calendar', '/client/messages', '/client/invoices', '/client/billing', '/client/meetings'],
    notes: [
      'Meetings page includes embedded Calendly booking and upcoming meeting list.',
      'Invoices and Billing are used for payment actions and account status.',
      'Deliverables page is used to review and approve work.',
    ],
  },
  va: {
    primaryRoutes: ['/va', '/va/time', '/va/academy', '/va/sops', '/va/standup'],
    notes: [
      'Task Board and Time Tracker are the core VA workflow pages.',
      'Standup page captures daily progress updates.',
      'SOPs and Academy are reference/training resources.',
    ],
  },
}

function getRoleKnowledge(role) {
  return APP_KNOWLEDGE[role] || APP_KNOWLEDGE.client
}

function fallbackReply(input, role) {
  const text = (input || '').toLowerCase()

  if (text.includes('invoice') || text.includes('payment') || text.includes('billing')) {
    return role === 'admin'
      ? 'For billing issues, open Revenue to review invoice status and payment history. If Stripe status looks wrong, refresh and check the Integrations page.'
      : 'For invoice questions, open Invoices or Billing in the left menu. If a payment still looks pending after paying, wait a minute then refresh.'
  }

  if (text.includes('meeting') || text.includes('call') || text.includes('calendly')) {
    return 'You can book directly in Meetings. After booking, upcoming calls should appear in-app automatically. If not, refresh once and check again in a few seconds.'
  }

  if (text.includes('deliverable') || text.includes('task') || text.includes('va')) {
    return role === 'va'
      ? 'Use Task Board for assignment status and Time Tracker for logged work. If a task is missing, ask your admin to confirm client/task mapping.'
      : 'Deliverables are tracked in Deliverables. You can approve or request changes there, and updates should sync for the team.'
  }

  if (text.includes('client') || text.includes('onboarding') || text.includes('invite')) {
    return 'Invite clients from the Clients page. Once they sign up, their portal status should switch from Invited to Joined and onboarding status should update automatically.'
  }

  if (text.includes('error') || text.includes('bug') || text.includes('not work') || text.includes('broken')) {
    return 'Try this quick triage: 1) hard refresh, 2) sign out/sign in, 3) retry on the exact page. If it still fails, send the page path and exact error text so I can diagnose it precisely.'
  }

  return 'I can help with meetings, invoices, onboarding, tasks, and portal issues. Tell me your page and goal, for example: "I am on /client/meetings and my booking is not showing."'
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { message, messages = [], role = 'client', page = '', context = {} } = req.body || {}
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'Message is required' })
  }

  const roleKnowledge = getRoleKnowledge(role)
  const trimmedMessage = message.trim().slice(0, 1200)

  const anthropicKey = process.env.ANTHROPIC_API_KEY
  if (!anthropicKey) {
    return res.status(200).json({ reply: fallbackReply(trimmedMessage, role), source: 'fallback' })
  }

  try {
    const client = new Anthropic({ apiKey: anthropicKey })

    const history = Array.isArray(messages)
      ? messages
          .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.text === 'string')
          .slice(-10)
          .map((m) => ({ role: m.role, content: m.text.slice(0, 1000) }))
      : []

    const response = await client.messages.create({
      model: process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-latest',
      max_tokens: 360,
      temperature: 0.3,
      system: `You are VirtueCore's in-app AI support assistant.
Use clear, practical guidance tailored to this app.

Rules:
- Be accurate and grounded in known app behavior.
- If uncertain, say what to verify instead of guessing.
- Prefer 1-3 concrete steps.
- Keep responses short (normally under 120 words) unless user asks for depth.
- If user reports an issue, include a quick troubleshoot sequence.

User context:
- Role: ${role}
- Current page: ${page}
- Name: ${context?.fullName || 'Unknown'}

Known routes for this role: ${roleKnowledge.primaryRoutes.join(', ')}
Known product notes: ${roleKnowledge.notes.join(' ')}
`,
      messages: [...history, { role: 'user', content: trimmedMessage }],
    })

    const reply = response?.content?.find((block) => block.type === 'text')?.text?.trim()
    if (!reply) {
      return res.status(200).json({ reply: fallbackReply(trimmedMessage, role), source: 'fallback' })
    }

    return res.status(200).json({ reply, source: 'anthropic' })
  } catch (error) {
    console.error('[Help Chat] AI call failed:', error.message)
    return res.status(200).json({ reply: fallbackReply(trimmedMessage, role), source: 'fallback' })
  }
}
