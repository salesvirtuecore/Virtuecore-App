// Shared across client Dashboard/Billing and the admin dashboard rollup —
// turns a cash-business client's manually-logged { "2026-08": 1200, ... }
// entries into the same total/last-90-days shape Stripe-synced clients get,
// so both revenue sources can feed the same UI without special-casing.
export function computeManualRevenueTotals(manualRevenueByMonth) {
  const byMonth = manualRevenueByMonth || {}
  const total = Object.values(byMonth).reduce((sum, v) => sum + Number(v || 0), 0)

  // Monthly-granularity entries can't be summed by exact calendar day, so
  // "last 90 days" is approximated as the current + prior 2 calendar months.
  const now = new Date()
  let last90Days = 0
  for (let i = 0; i < 3; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))
    const key = d.toISOString().slice(0, 7)
    last90Days += Number(byMonth[key] || 0)
  }

  return { total, last90Days }
}
