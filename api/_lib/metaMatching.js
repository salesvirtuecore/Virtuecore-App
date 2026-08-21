import Anthropic from '@anthropic-ai/sdk'

const DROP_WORDS = new Set(['llc', 'inc', 'ltd', 'co', 'corp', 'limited', 'company', 'the'])

// Lowercase, strip punctuation, drop common legal-entity suffixes.
export function normalizeName(name) {
  if (!name || typeof name !== 'string') return ''
  const cleaned = name.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
  return cleaned.split(' ').filter((w) => w && !DROP_WORDS.has(w)).join(' ')
}

// adAccounts: [{account_id, name, business_name}]
// clients: [{id, company_name}]
// Returns { exactMatches: [{account, client}], queueRows: [...] } — nothing
// beyond exactMatches is ever safe to auto-write to clients.meta_ad_account_id.
export async function matchAdAccountsToClients({ adAccounts, clients }) {
  const exactMatches = []
  const usedClientIds = new Set()
  const unmatchedAccounts = []

  for (const account of adAccounts) {
    const accountNorm = normalizeName(account.business_name || account.name)
    const match = accountNorm ? clients.find((c) => !usedClientIds.has(c.id) && normalizeName(c.company_name) === accountNorm) : null
    if (match) {
      exactMatches.push({ account, client: match })
      usedClientIds.add(match.id)
    } else {
      unmatchedAccounts.push(account)
    }
  }

  const remainingClients = clients.filter((c) => !usedClientIds.has(c.id))
  const aiSuggestions = (unmatchedAccounts.length > 0 && remainingClients.length > 0 && process.env.ANTHROPIC_API_KEY)
    ? await suggestMatchesWithAI(unmatchedAccounts, remainingClients)
    : []

  const queueRows = unmatchedAccounts.map((account) => {
    const suggestion = aiSuggestions.find((s) => s.account_id === account.account_id)
    return suggestion
      ? {
          ad_account_id: account.account_id,
          ad_account_name: account.name || null,
          business_name: account.business_name || null,
          suggested_client_id: suggestion.client_id,
          suggested_client_name: suggestion.client_name,
          match_type: 'ai_suggested',
          confidence_score: suggestion.confidence ?? null,
        }
      : {
          ad_account_id: account.account_id,
          ad_account_name: account.name || null,
          business_name: account.business_name || null,
          suggested_client_id: null,
          suggested_client_name: null,
          match_type: 'none',
          confidence_score: null,
        }
  })

  return { exactMatches, queueRows }
}

// Suggestions only — never auto-written anywhere. A malformed/empty response
// just means everything falls through to the manual queue as 'none'.
async function suggestMatchesWithAI(accounts, clients) {
  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const prompt = `You are matching Facebook/Meta ad accounts to client companies by name similarity.

Ad accounts:
${accounts.map((a) => `- account_id: ${a.account_id}, name: "${a.name || ''}", business_name: "${a.business_name || ''}"`).join('\n')}

Clients:
${clients.map((c) => `- id: ${c.id}, name: "${c.company_name}"`).join('\n')}

Respond with ONLY a JSON array (no other text, no markdown fences) of objects for pairings you're reasonably confident about: [{"account_id": "...", "client_id": "...", "client_name": "...", "confidence": 0.0-1.0}]. Omit any ad account you're not confident matches a client — do not guess.`
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    })
    const text = message.content?.[0]?.text || '[]'
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) return []
    const parsed = JSON.parse(jsonMatch[0])
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}
