// /api/generate-report.js
// Generates a professional performance report using Anthropic Claude,
// then inserts the result into the Supabase deliverables + reports tables.
//
// NOTE: Run `npm install @anthropic-ai/sdk` before deploying.
//
// Required env vars:
//   ANTHROPIC_API_KEY
//   VITE_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY

import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { client_id, client_name, period, ad_data = [] } = req.body ?? {}

  if (!client_id || !client_name || !period) {
    return res.status(400).json({
      error: 'client_id, client_name, and period are required',
    })
  }

  try {
    // ── Build Anthropic prompt ─────────────────────────────────────────────────
    const dataDescription =
      ad_data.length > 0
        ? JSON.stringify(ad_data, null, 2)
        : 'No raw data provided — use reasonable example figures for a UK local service business.'

    const prompt = `You are a senior performance marketing analyst writing a client-facing report for ${client_name} covering the period: ${period}.

Ad performance data:
${dataDescription}

Write a professional, data-driven performance report with the following sections:

1. Executive Summary (2–3 sentences, headline achievements)
2. Key Highlights (bullet points — top metrics, wins, notable trends)
3. Platform Breakdown (Meta Ads and Google Ads performance separately if data exists)
4. Recommendations (3–5 actionable recommendations for the next period)
5. Next Steps (2–3 concrete next steps with implied timelines)

Tone: professional, confident, client-facing. Use British English. Format with clear section headings.`

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    })

    const reportText =
      message.content?.[0]?.type === 'text'
        ? message.content[0].text
        : 'Report generation failed — no content returned.'

    // ── Insert into Supabase ───────────────────────────────────────────────────
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    const deliverableTitle = `${client_name} — Performance Report ${period}`

    // 1. Create a deliverable record
    const { data: deliverable, error: deliverableError } = await supabase
      .from('deliverables')
      .insert({
        client_id,
        title: deliverableTitle,
        type: 'report',
        status: 'draft',
        file_url: null, // content stored in reports table
      })
      .select('id')
      .single()

    if (deliverableError) {
      console.error('Deliverable insert error:', deliverableError)
    }

    const deliverable_id = deliverable?.id ?? null

    // 2. Create the report content record
    const { error: reportError } = await supabase.from('reports').insert({
      client_id,
      deliverable_id,
      content: reportText,
      period,
    })

    if (reportError) {
      console.error('Report insert error:', reportError)
    }

    return res.status(200).json({
      success: true,
      report: reportText,
      deliverable_id,
    })
  } catch (err) {
    console.error('generate-report handler error:', err)
    return res.status(500).json({ error: 'Internal server error', detail: err.message })
  }
}
