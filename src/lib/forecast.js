// Least-squares linear fit over {x, y} points. With fewer than 2 points
// there's no trend to fit, so the forecast just holds flat at the last
// known value.
export function linearRegression(points) {
  const n = points.length
  if (n < 2) return { slope: 0, intercept: points[0]?.y || 0 }
  const sumX = points.reduce((s, p) => s + p.x, 0)
  const sumY = points.reduce((s, p) => s + p.y, 0)
  const sumXY = points.reduce((s, p) => s + p.x * p.y, 0)
  const sumXX = points.reduce((s, p) => s + p.x * p.x, 0)
  const denom = n * sumXX - sumX * sumX
  const slope = denom !== 0 ? (n * sumXY - sumX * sumY) / denom : 0
  const intercept = (sumY - slope * sumX) / n
  return { slope, intercept }
}

// Projects a single revenue series forward `monthsAhead` months from real
// monthly history. `monthlyRows` must be sorted ascending and each row needs
// `revenue` and `sortKey` (a millisecond timestamp for the 1st of that month).
export function buildMonthlyForecast(monthlyRows, monthsAhead = 3) {
  const real = (monthlyRows || []).filter((row) => Number(row.revenue) > 0)
  if (real.length < 2) return []
  const points = real.map((row, i) => ({ x: i, y: Number(row.revenue || 0) }))
  const reg = linearRegression(points)
  const lastDate = new Date(real[real.length - 1].sortKey)

  const forecast = []
  for (let i = 1; i <= monthsAhead; i++) {
    const x = real.length - 1 + i
    const forecastDate = new Date(Date.UTC(lastDate.getUTCFullYear(), lastDate.getUTCMonth() + i, 1))
    forecast.push({
      month: forecastDate.toLocaleDateString('en-GB', { month: 'short' }),
      sortKey: forecastDate.getTime(),
      revenueForecast: Math.max(0, Math.round(reg.slope * x + reg.intercept)),
    })
  }
  return forecast
}
