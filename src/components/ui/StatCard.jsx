export default function StatCard({ label, value, sub, trend, icon: Icon, prefix = '', suffix = '' }) {
  const isPositive = trend > 0
  const isNegative = trend < 0

  return (
    <div className="vc-card flex flex-col gap-3 min-w-0">
      <div className="flex items-start justify-between gap-2">
        <p className="vc-section-label">{label}</p>
        {Icon && (
          <div className="p-1.5 rounded bg-bg-tertiary flex-shrink-0">
            <Icon size={14} className="text-text-tertiary" />
          </div>
        )}
      </div>

      <div>
        <p className="vc-metric">
          {prefix}{value}{suffix}
        </p>
        {sub && <p className="text-text-tertiary text-xs mt-1">{sub}</p>}
      </div>

      {trend !== undefined && (
        <p className={`text-xs font-medium ${isPositive ? 'delta-up' : isNegative ? 'delta-down' : 'delta-flat'}`}>
          {isPositive ? '▲' : isNegative ? '▼' : '—'} {Math.abs(trend)}% vs last week
        </p>
      )}
    </div>
  )
}
