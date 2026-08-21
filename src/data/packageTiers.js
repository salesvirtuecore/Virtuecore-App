// Package tiers offered to clients. Retainer/pricing amounts are set
// per-client (monthly_retainer, revenue_share_percentage) — this file only
// controls which dashboard sections a package unlocks.
export const PACKAGE_TIERS = ['Website Only', 'Automations', 'Website + Paid Ads', 'VA Package', 'Full Package']

// Tiers with no paid-ads or VA component get a stripped-down client
// dashboard (website analytics, messages, revenue only) — everything else
// unlocks the full dashboard (ad performance, forecast, CAC, Meta status).
const RESTRICTED_TIERS = new Set(['Website Only', 'Automations'])

export function isRestrictedTier(packageTier) {
  return RESTRICTED_TIERS.has(packageTier)
}
