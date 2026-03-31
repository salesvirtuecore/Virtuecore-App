export default function Badge({ children, variant = 'default', dot = false, size = 'sm' }) {
  const variants = {
    default: 'bg-white/[0.06] text-text-secondary',
    green:   'bg-status-success/10 text-status-success',
    amber:   'bg-status-warning/10 text-status-warning',
    red:     'bg-status-danger/10 text-status-danger',
    blue:    'bg-status-info/10 text-status-info',
    purple:  'bg-vc-primary/10 text-vc-accent',
    // Semantic aliases
    success: 'bg-status-success/10 text-status-success',
    warning: 'bg-status-warning/10 text-status-warning',
    danger:  'bg-status-danger/10 text-status-danger',
    info:    'bg-status-info/10 text-status-info',
    // Legacy
    gold:    'bg-vc-primary/10 text-vc-accent',
  }
  const dotColors = {
    default: 'bg-text-secondary',
    green: 'bg-status-success', success: 'bg-status-success',
    amber: 'bg-status-warning', warning: 'bg-status-warning',
    red: 'bg-status-danger',   danger: 'bg-status-danger',
    blue: 'bg-status-info',    info: 'bg-status-info',
    purple: 'bg-vc-primary',   gold: 'bg-vc-primary',
  }
  const sizes = {
    xs: 'px-1.5 py-0.5 text-[11px]',
    sm: 'px-2 py-0.5 text-xs font-medium',
    md: 'px-2.5 py-1 text-sm font-medium',
  }
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-badge ${variants[variant] ?? variants.default} ${sizes[size]}`}>
      {dot && <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotColors[variant] ?? dotColors.default}`} />}
      {children}
    </span>
  )
}
