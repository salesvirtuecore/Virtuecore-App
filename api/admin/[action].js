import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

function makeSupabase() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Server not configured')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

// ── invite-user ──────────────────────────────────────────────────────────────
async function handleInviteUser(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  const supabase = makeSupabase()
  const n8nClientWebhookUrl = process.env.N8N_CLIENT_WEBHOOK_URL || process.env.N8N_WEBHOOK_URL || ''
  const n8nVaWebhookUrl = process.env.N8N_VA_WEBHOOK_URL || process.env.N8N_WEBHOOK_URL || ''
  const { email, full_name, role, company_name, package_tier, monthly_retainer, revenue_share_percentage } = req.body
  if (!email || !role) return res.status(400).json({ error: 'Email and role are required' })
  try {
    if (role === 'client') {
      const { error: clientError } = await supabase.from('clients').insert({
        company_name: company_name || full_name, contact_name: full_name, contact_email: email,
        package_tier: package_tier || 'Starter', monthly_retainer: monthly_retainer || 0,
        revenue_share_percentage: revenue_share_percentage || 0, status: 'onboarding',
        onboarding_started_at: new Date().toISOString(),
      })
      if (clientError) throw clientError
    }
    const isVA = role === 'va'
    const appUrl = process.env.VITE_APP_URL || 'https://virtuecore-app.vercel.app'
    const signupUrl = isVA ? `${appUrl}/signup/va` : `${appUrl}/signup`
    const n8nWebhookUrl = isVA ? n8nVaWebhookUrl : n8nClientWebhookUrl
    const emailSubject = isVA ? `You've been invited to join VirtueCore as a Virtual Assistant` : `You've been invited to your VirtueCore Client Portal`
    const emailBody = isVA
      ? `Hi ${full_name || 'there'},\n\nYou've been invited to VirtueCore as a Virtual Assistant.\n\nClick the link below to create your account:\n${signupUrl}\n\nWelcome to the team,\nThe VirtueCore Team`
      : `Hi ${full_name || 'there'},\n\nYou've been invited to your VirtueCore Client Portal.\n\nClick the link below to get started:\n${signupUrl}\n\nLooking forward to working with you,\nThe VirtueCore Team`
    const n8nPayload = { to: email, from: 'sales@virtuecore.co.uk', subject: emailSubject, emailSubject, full_name: full_name || '', company_name: company_name || '', role, signupUrl, emailBody, body: emailBody, text: emailBody, message: emailBody }
    if (n8nWebhookUrl) {
      const n8nRes = await fetch(n8nWebhookUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(n8nPayload) })
      if (!n8nRes.ok) throw new Error(`n8n failed: ${n8nRes.status} ${await n8nRes.text()}`)
    }
    return res.status(200).json({ success: true })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}

// ── delete-user ──────────────────────────────────────────────────────────────
async function handleDeleteUser(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  const { email } = req.body
  if (!email) return res.status(400).json({ error: 'Email required' })
  const supabase = makeSupabase()
  const { data: { users }, error: listError } = await supabase.auth.admin.listUsers()
  if (listError) return res.status(500).json({ error: listError.message })
  const user = users.find((u) => u.email?.toLowerCase() === email.toLowerCase())
  if (!user) return res.status(404).json({ error: 'User not found' })
  const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id)
  if (deleteError) return res.status(500).json({ error: deleteError.message })
  await supabase.from('profiles').delete().eq('id', user.id)
  return res.status(200).json({ success: true, deleted: email })
}

// ── register-va ──────────────────────────────────────────────────────────────
async function handleRegisterVA(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  const { user_id, email, full_name } = req.body
  if (!user_id || !email) return res.status(400).json({ error: 'Missing user_id or email' })
  const supabase = makeSupabase()
  const { error } = await supabase.from('profiles').upsert({ id: user_id, email, full_name: full_name || '', role: 'va' }, { onConflict: 'id' })
  if (error) return res.status(500).json({ error: error.message })
  return res.status(200).json({ ok: true })
}

// ── generate-report ──────────────────────────────────────────────────────────
async function handleGenerateReport(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  const { client_id, client_name, period, ad_data = [] } = req.body ?? {}
  if (!client_id || !client_name || !period) return res.status(400).json({ error: 'client_id, client_name, and period are required' })
  const anthropicKey = process.env.ANTHROPIC_API_KEY
  if (!anthropicKey) return res.status(500).json({ error: 'Anthropic not configured' })
  try {
    const dataDescription = ad_data.length > 0 ? JSON.stringify(ad_data, null, 2) : 'No raw data provided — use reasonable example figures for a UK local service business.'
    const prompt = `You are a senior performance marketing analyst writing a client-facing report for ${client_name} covering the period: ${period}.\n\nAd performance data:\n${dataDescription}\n\nWrite a professional, data-driven performance report with: 1. Executive Summary, 2. Key Highlights, 3. Platform Breakdown, 4. Recommendations, 5. Next Steps. Tone: professional, client-facing. British English.`
    const anthropic = new Anthropic({ apiKey: anthropicKey })
    const message = await anthropic.messages.create({ model: 'claude-sonnet-4-6', max_tokens: 1500, messages: [{ role: 'user', content: prompt }] })
    const reportText = message.content?.[0]?.type === 'text' ? message.content[0].text : 'Report generation failed.'
    const supabase = makeSupabase()
    const { data: deliverable } = await supabase.from('deliverables').insert({ client_id, title: `${client_name} — Performance Report ${period}`, type: 'report', status: 'draft', file_url: null }).select('id').single()
    await supabase.from('reports').insert({ client_id, deliverable_id: deliverable?.id ?? null, content: reportText, period })
    return res.status(200).json({ success: true, report: reportText, deliverable_id: deliverable?.id ?? null })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}

// ── parse-content-plan ───────────────────────────────────────────────────────
async function handleParseContentPlan(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  const { client_id, file_url } = req.body ?? {}
  if (!client_id || !file_url) return res.status(400).json({ error: 'client_id and file_url are required' })
  const anthropicKey = process.env.ANTHROPIC_API_KEY
  if (!anthropicKey) return res.status(500).json({ error: 'Anthropic not configured' })
  const supabase = makeSupabase()

  // Download file — use Supabase admin storage when possible to bypass bucket permissions
  let fileBuffer = null
  try {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
    const storageBase = `${supabaseUrl}/storage/v1/object/public/deliverables/`
    if (file_url.startsWith(storageBase)) {
      const path = decodeURIComponent(file_url.replace(storageBase, ''))
      const { data: blob, error: dlError } = await supabase.storage.from('deliverables').download(path)
      if (dlError) throw new Error(`Storage download failed: ${dlError.message}`)
      fileBuffer = Buffer.from(await blob.arrayBuffer())
    } else {
      const fileRes = await fetch(file_url)
      if (!fileRes.ok) throw new Error(`Fetch failed: ${fileRes.status}`)
      fileBuffer = Buffer.from(await fileRes.arrayBuffer())
    }
  } catch (err) {
    return res.status(500).json({ error: `Could not read file: ${err.message}` })
  }

  // Parse with Claude
  let posts = []
  try {
    const anthropic = new Anthropic({ apiKey: anthropicKey })
    const isPdf = file_url.toLowerCase().includes('.pdf')
    let fileText = ''
    if (isPdf) {
      const base64 = fileBuffer.toString('base64')
      const r = await anthropic.messages.create({
        model: 'claude-sonnet-4-6', max_tokens: 4096,
        messages: [{ role: 'user', content: [
          { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } },
          { type: 'text', text: 'Extract all social media posts from this content plan. Return ONLY a valid JSON array, no markdown fences. Each item must have: {"post_date":"YYYY-MM-DD","platform":"Instagram|Facebook|TikTok|LinkedIn|Twitter","content":"caption text","status":"scheduled"}' },
        ]}],
      })
      fileText = r.content[0].text
    } else {
      const text = fileBuffer.toString('utf8')
      const r = await anthropic.messages.create({
        model: 'claude-sonnet-4-6', max_tokens: 4096,
        messages: [{ role: 'user', content: `Extract social media posts as a JSON array. Each: {"post_date":"YYYY-MM-DD","platform":"Instagram|Facebook|TikTok|LinkedIn|Twitter","content":"text","status":"scheduled"}. Return ONLY the JSON array.\n\n${text.slice(0, 12000)}` }],
      })
      fileText = r.content[0].text
    }
    posts = JSON.parse(fileText.trim().replace(/^```json\n?/, '').replace(/\n?```$/, '').trim())
  } catch (err) {
    return res.status(500).json({ error: `Parse failed: ${err.message}` })
  }

  if (!Array.isArray(posts) || posts.length === 0) return res.status(422).json({ error: 'No posts extracted from file' })

  const rows = posts
    .filter((p) => p.post_date && p.platform && p.content)
    .map((p) => ({ client_id, post_date: p.post_date, platform: p.platform, content: p.content, status: p.status || 'scheduled' }))

  // Delete existing entries for the same dates first (avoids unique constraint requirement)
  const dates = [...new Set(rows.map((r) => r.post_date))]
  await supabase.from('content_calendar').delete().eq('client_id', client_id).in('post_date', dates)

  const { error: insertError } = await supabase.from('content_calendar').insert(rows)
  if (insertError) return res.status(500).json({ error: `DB insert failed: ${insertError.message}` })

  return res.status(200).json({ ok: true, posts_imported: rows.length })
}

// ── monthly-report ───────────────────────────────────────────────────────────
async function handleMonthlyReport(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).end()
  if (req.method === 'POST') {
    const auth = req.headers['x-cron-secret'] || req.body?.secret
    if (auth !== process.env.CRON_SECRET) return res.status(401).json({ error: 'Unauthorized' })
  }
  const anthropicKey = process.env.ANTHROPIC_API_KEY
  if (!anthropicKey) return res.status(500).json({ error: 'Anthropic not configured' })
  const now = new Date()
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const period = prev.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0]
  const end = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0]
  const supabase = makeSupabase()
  const { data: clients } = await supabase.from('clients').select('id, company_name, contact_email').eq('status', 'active')
  if (!clients?.length) return res.status(200).json({ ok: true, message: 'No active clients' })
  const anthropic = new Anthropic({ apiKey: anthropicKey })
  const n8nWebhook = process.env.N8N_REPORT_WEBHOOK_URL
  const results = []
  for (const client of clients) {
    try {
      const [invoiceRes, deliverableRes, meetingRes, adRes] = await Promise.all([
        supabase.from('invoices').select('amount,status').eq('client_id', client.id).gte('created_at', start).lte('created_at', end),
        supabase.from('deliverables').select('title,status').eq('client_id', client.id).gte('created_at', start).lte('created_at', end),
        supabase.from('meetings').select('status').eq('client_id', client.id).gte('start_time', start).lte('start_time', end),
        supabase.from('ad_performance').select('spend,leads,roas,ctr').eq('client_id', client.id).gte('date', start).lte('date', end),
      ])
      const invoices = invoiceRes.data || [], deliverables = deliverableRes.data || [], meetings = meetingRes.data || [], adData = adRes.data || []
      if (!invoices.length && !deliverables.length && !meetings.length && !adData.length) { results.push({ client: client.company_name, skipped: true }); continue }
      const sections = []
      if (adData.length) { const s = adData.reduce((a, r) => a + Number(r.spend || 0), 0); const l = adData.reduce((a, r) => a + Number(r.leads || 0), 0); sections.push(`Ad Performance: £${s.toFixed(0)} spend, ${l} leads`) }
      if (invoices.length) { const paid = invoices.filter((i) => i.status === 'paid').reduce((a, i) => a + Number(i.amount), 0); sections.push(`Invoices: £${paid.toFixed(0)} paid`) }
      if (deliverables.length) sections.push(`Deliverables: ${deliverables.length} delivered, ${deliverables.filter((d) => d.status === 'approved').length} approved`)
      if (meetings.length) sections.push(`Meetings: ${meetings.length} completed`)
      const msg = await anthropic.messages.create({ model: 'claude-sonnet-4-6', max_tokens: 1200, messages: [{ role: 'user', content: `Write a professional monthly client report for ${client.company_name} covering ${period}. Data: ${sections.join(', ')}. Sections: Executive Summary, Key Highlights, ${adData.length ? 'Performance Breakdown,' : ''} ${deliverables.length ? 'Deliverables Completed,' : ''} Recommendations, Next Steps. British English. Only reference actual data.` }] })
      const reportText = msg.content?.[0]?.type === 'text' ? msg.content[0].text : null
      if (!reportText) throw new Error('No content from Claude')
      const { data: del } = await supabase.from('deliverables').insert({ client_id: client.id, title: `${client.company_name} — Monthly Report ${period}`, type: 'report', status: 'pending_review' }).select('id').single()
      await supabase.from('reports').insert({ client_id: client.id, deliverable_id: del?.id ?? null, content: reportText, period })
      if (n8nWebhook && client.contact_email) { await fetch(n8nWebhook, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ to: client.contact_email, company_name: client.company_name, period, report: reportText, portal_url: `${process.env.VITE_APP_URL || 'https://virtuecore-app.vercel.app'}/client/deliverables` }) }).catch(() => {}) }
      results.push({ client: client.company_name, ok: true })
    } catch (err) {
      results.push({ client: client.company_name, error: err.message })
    }
  }
  return res.status(200).json({ ok: true, period, results })
}

// ── meta-ads ─────────────────────────────────────────────────────────────────
async function handleMetaAds(req, res) {
  if (req.method !== 'GET') return res.status(405).end()
  const authHeader = req.headers['authorization'] ?? ''
  const token = authHeader.replace('Bearer ', '').trim()
  if (!token || token !== process.env.ZAPIER_WEBHOOK_SECRET) return res.status(401).json({ error: 'Unauthorised' })
  const { client_id, account_id, date_preset = 'last_30d' } = req.query
  if (!account_id) return res.status(400).json({ error: 'account_id is required' })
  try {
    const metaUrl = new URL(`https://graph.facebook.com/v19.0/${account_id}/insights`)
    metaUrl.searchParams.set('fields', 'spend,impressions,clicks,leads,conversions,ctr,cost_per_unique_action_type,purchase_roas')
    metaUrl.searchParams.set('date_preset', date_preset)
    metaUrl.searchParams.set('access_token', process.env.META_ADS_ACCESS_TOKEN)
    const metaResponse = await fetch(metaUrl.toString())
    if (!metaResponse.ok) return res.status(502).json({ error: 'Meta API error', detail: await metaResponse.text() })
    const metaData = await metaResponse.json()
    const insights = metaData.data ?? []
    const supabase = makeSupabase()
    const rows = insights.map((row) => {
      const cplEntry = Array.isArray(row.cost_per_unique_action_type) ? row.cost_per_unique_action_type.find((a) => a.action_type === 'lead') : null
      const roas = Array.isArray(row.purchase_roas) ? parseFloat(row.purchase_roas[0]?.value ?? 0) : parseFloat(row.purchase_roas ?? 0)
      return { client_id: client_id ?? null, platform: 'meta', date: row.date_start ?? new Date().toISOString().split('T')[0], spend: parseFloat(row.spend ?? 0), impressions: parseInt(row.impressions ?? 0, 10), clicks: parseInt(row.clicks ?? 0, 10), leads: parseInt(row.leads ?? 0, 10), conversions: parseInt(row.conversions ?? 0, 10), ctr: parseFloat(row.ctr ?? 0), cpl: parseFloat(cplEntry?.value ?? 0), roas }
    })
    if (rows.length > 0) await supabase.from('ad_performance').upsert(rows, { onConflict: 'client_id,platform,date' })
    return res.status(200).json({ success: true, rows })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}

// ── help-chat ─────────────────────────────────────────────────────────────────
const APP_KNOWLEDGE = {
  admin: { primaryRoutes: ['/admin', '/admin/clients', '/admin/pipeline', '/admin/vas', '/admin/revenue'], notes: ['Clients page manages invites, onboarding, status, and Stripe.', 'Revenue page manages invoice workflows.', 'Pipeline tracks lead stages.'] },
  client: { primaryRoutes: ['/client', '/client/deliverables', '/client/calendar', '/client/messages', '/client/invoices', '/client/billing', '/client/meetings'], notes: ['Deliverables page is used to review and approve work.', 'Invoices and Billing for payment actions.'] },
  va: { primaryRoutes: ['/va', '/va/time', '/va/academy', '/va/sops', '/va/standup'], notes: ['Task Board and Time Tracker are core VA workflow pages.', 'Standup captures daily progress updates.'] },
}
function fallbackReply(input, role) {
  const text = (input || '').toLowerCase()
  if (text.includes('invoice') || text.includes('payment')) return role === 'admin' ? 'Open Revenue to review invoice status.' : 'Open Invoices or Billing in the left menu.'
  if (text.includes('meeting') || text.includes('call')) return 'You can book directly in Meetings.'
  if (text.includes('deliverable') || text.includes('task')) return role === 'va' ? 'Use Task Board for assignments.' : 'Deliverables are tracked in Deliverables.'
  return 'I can help with meetings, invoices, onboarding, tasks, and portal issues.'
}
async function handleHelpChat(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  const { message, messages = [], role = 'client', page = '', context = {} } = req.body || {}
  if (!message || typeof message !== 'string') return res.status(400).json({ error: 'Message is required' })
  const roleKnowledge = APP_KNOWLEDGE[role] || APP_KNOWLEDGE.client
  const trimmedMessage = message.trim().slice(0, 1200)
  const anthropicKey = process.env.ANTHROPIC_API_KEY
  if (!anthropicKey) return res.status(200).json({ reply: fallbackReply(trimmedMessage, role), source: 'fallback' })
  try {
    const client = new Anthropic({ apiKey: anthropicKey })
    const history = Array.isArray(messages) ? messages.filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.text === 'string').slice(-10).map((m) => ({ role: m.role, content: m.text.slice(0, 1000) })) : []
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6', max_tokens: 360, temperature: 0.3,
      system: `You are VirtueCore's in-app AI support assistant. Role: ${role}. Page: ${page}. Name: ${context?.fullName || 'Unknown'}. Routes: ${roleKnowledge.primaryRoutes.join(', ')}. Notes: ${roleKnowledge.notes.join(' ')}. Be concise, practical, under 120 words.`,
      messages: [...history, { role: 'user', content: trimmedMessage }],
    })
    const reply = response?.content?.find((b) => b.type === 'text')?.text?.trim()
    return res.status(200).json({ reply: reply || fallbackReply(trimmedMessage, role), source: reply ? 'anthropic' : 'fallback' })
  } catch {
    return res.status(200).json({ reply: fallbackReply(trimmedMessage, role), source: 'fallback' })
  }
}

// ── weekly-pulse ──────────────────────────────────────────────────────────────
async function handleWeeklyPulse(req, res) {
  if (req.method !== 'GET') return res.status(405).end()
  const { client_id } = req.query
  if (!client_id) return res.status(400).json({ error: 'client_id required' })
  const supabase = makeSupabase()
  const now = new Date()
  const weekStart = new Date(now); weekStart.setDate(now.getDate() - 7)
  const prevWeekStart = new Date(weekStart); prevWeekStart.setDate(weekStart.getDate() - 7)
  const weekStartStr = weekStart.toISOString().split('T')[0]
  const prevWeekStartStr = prevWeekStart.toISOString().split('T')[0]
  const nowStr = now.toISOString().split('T')[0]
  const [adRes, prevAdRes, msgRes, delRes] = await Promise.all([
    supabase.from('ad_performance').select('spend,leads,cpl,roas').eq('client_id', client_id).gte('date', weekStartStr).lte('date', nowStr),
    supabase.from('ad_performance').select('spend,leads,cpl').eq('client_id', client_id).gte('date', prevWeekStartStr).lt('date', weekStartStr),
    supabase.from('messages').select('id').eq('client_id', client_id).gte('created_at', weekStart.toISOString()),
    supabase.from('deliverables').select('id').eq('client_id', client_id).in('status', ['approved', 'pending_review']).gte('created_at', weekStart.toISOString()),
  ])
  const ad = adRes.data || [], prevAd = prevAdRes.data || []
  const spend = ad.reduce((s, r) => s + Number(r.spend || 0), 0)
  const leads = ad.reduce((s, r) => s + Number(r.leads || 0), 0)
  const prevSpend = prevAd.reduce((s, r) => s + Number(r.spend || 0), 0)
  const prevLeads = prevAd.reduce((s, r) => s + Number(r.leads || 0), 0)
  const cpl = leads > 0 ? Math.round(spend / leads) : null
  const prevCpl = prevLeads > 0 ? Math.round(prevSpend / prevLeads) : null
  function pct(a, b) { return b > 0 ? Math.round((a - b) / b * 100) : null }
  return res.status(200).json({
    ok: true,
    week_start: weekStartStr,
    this_week: { spend, leads, cpl, messages: msgRes.data?.length || 0, deliverables: delRes.data?.length || 0 },
    prev_week: { spend: prevSpend, leads: prevLeads, cpl: prevCpl },
    wow: { leads: pct(leads, prevLeads), spend: pct(spend, prevSpend), cpl: pct(cpl, prevCpl) },
  })
}

// ── save-nps ─────────────────────────────────────────────────────────────────
async function handleSaveNPS(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  const { user_id, client_id, score, comment } = req.body ?? {}
  if (!user_id || !score) return res.status(400).json({ error: 'user_id and score required' })
  const supabase = makeSupabase()
  const { error } = await supabase.from('nps_responses').insert({
    user_id, client_id: client_id || null,
    score: Number(score), comment: comment || null,
    created_at: new Date().toISOString(),
  })
  // Don't fail loudly if table doesn't exist yet
  if (error && !error.message.includes('does not exist')) return res.status(500).json({ error: error.message })
  return res.status(200).json({ ok: true })
}

// ── smart-notifications ───────────────────────────────────────────────────────
async function handleSmartNotifications(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  const { user_id, client_id } = req.body ?? {}
  if (!user_id || !client_id) return res.status(400).json({ error: 'user_id and client_id required' })
  const supabase = makeSupabase()
  const today = new Date().toISOString().split('T')[0]

  // Only run once per day per user
  const { data: recent } = await supabase.from('notifications').select('id').eq('user_id', user_id).eq('type', 'smart').gte('created_at', today).limit(1)
  if (recent?.length) return res.status(200).json({ ok: true, skipped: true })

  const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7)
  const twoWeeksAgo = new Date(); twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14)
  const weekAgoStr = weekAgo.toISOString().split('T')[0]
  const twoWeeksAgoStr = twoWeeksAgo.toISOString().split('T')[0]
  const todayStr = today

  const [thisRes, prevRes] = await Promise.all([
    supabase.from('ad_performance').select('spend,leads,cpl').eq('client_id', client_id).gte('date', weekAgoStr).lte('date', todayStr),
    supabase.from('ad_performance').select('spend,leads,cpl').eq('client_id', client_id).gte('date', twoWeeksAgoStr).lt('date', weekAgoStr),
  ])

  const thisWeek = thisRes.data || []
  const prevWeek = prevRes.data || []
  const alerts = []

  if (thisWeek.length >= 3 && prevWeek.length >= 3) {
    const thisSpend = thisWeek.reduce((s, r) => s + Number(r.spend || 0), 0)
    const prevSpend = prevWeek.reduce((s, r) => s + Number(r.spend || 0), 0)
    const thisLeads = thisWeek.reduce((s, r) => s + Number(r.leads || 0), 0)
    const prevLeads = prevWeek.reduce((s, r) => s + Number(r.leads || 0), 0)
    const thisCpl = thisLeads > 0 ? Math.round(thisSpend / thisLeads) : 0
    const prevCpl = prevLeads > 0 ? Math.round(prevSpend / prevLeads) : 0
    const thisAvgDaily = thisSpend / thisWeek.length
    const prevAvgDaily = prevSpend / prevWeek.length

    // Spend under budget
    if (prevAvgDaily > 0 && thisAvgDaily < prevAvgDaily * 0.8) {
      const under = Math.round((1 - thisAvgDaily / prevAvgDaily) * 100)
      alerts.push({ title: `Ad spend is ${under}% under last week's pace`, body: `Daily average is £${Math.round(thisAvgDaily)} vs £${Math.round(prevAvgDaily)} last week — there may be room to scale or a campaign needs attention.` })
    }
    // CPL improvement
    if (prevCpl > 0 && thisCpl > 0 && thisCpl < prevCpl * 0.9) {
      const imp = Math.round((1 - thisCpl / prevCpl) * 100)
      alerts.push({ title: `CPL improved ${imp}% this week 📉`, body: `Cost per lead dropped from £${prevCpl} to £${thisCpl} — your campaigns are getting more efficient.` })
    }
    // Lead increase record
    if (prevLeads > 0 && thisLeads > prevLeads * 1.25) {
      const inc = Math.round((thisLeads / prevLeads - 1) * 100)
      alerts.push({ title: `Lead volume up ${inc}% this week 🚀`, body: `${thisLeads} leads this week vs ${prevLeads} last week — your best performance yet.` })
    }
  }

  if (alerts.length) {
    await supabase.from('notifications').insert(alerts.map((a) => ({
      user_id, type: 'smart', title: a.title, body: a.body, read: false, created_at: new Date().toISOString(),
    })))
  }

  return res.status(200).json({ ok: true, alerts_created: alerts.length })
}

// ── Router ────────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  const action = req.query.action
  if (action === 'invite-user') return handleInviteUser(req, res)
  if (action === 'delete-user') return handleDeleteUser(req, res)
  if (action === 'register-va') return handleRegisterVA(req, res)
  if (action === 'generate-report') return handleGenerateReport(req, res)
  if (action === 'parse-content-plan') return handleParseContentPlan(req, res)
  if (action === 'monthly-report') return handleMonthlyReport(req, res)
  if (action === 'meta-ads') return handleMetaAds(req, res)
  if (action === 'help-chat') return handleHelpChat(req, res)
  if (action === 'weekly-pulse') return handleWeeklyPulse(req, res)
  if (action === 'save-nps') return handleSaveNPS(req, res)
  if (action === 'smart-notifications') return handleSmartNotifications(req, res)
  return res.status(404).json({ error: 'Unknown action' })
}
