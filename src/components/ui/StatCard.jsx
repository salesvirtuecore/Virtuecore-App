export default function StatCard({ label, value, sub, trend, icon: Icon }) {
  const trendPositive = trend > 0
  return (
    <div className="bg-white border border-vc-border p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-vc-muted uppercase tracking-wide font-medium">{label}</p>
          <p className="text-2xl font-semibold text-vc-text mt-1">{value}</p>
          {sub && <p className="text-xs text-vc-muted mt-0.5">{sub}</p>}
          {trend !== undefined && (
            <p className={`text-xs mt-1 font-medium ${trendPositive ? 'text-green-600' : 'text-red-500'}`}>
              {trendPositive ? '▲' : '▼'} {Math.abs(trend)}% vs last month
            </p>
          )}
        </div>
        {Icon && (
          <div className="p-2 bg-vc-secondary">
            <Icon size={18} className="text-vc-muted" />
          </div>
        )}
      </div>
    </div>
  )
}
