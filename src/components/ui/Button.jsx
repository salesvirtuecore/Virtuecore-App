export default function Button({
  children, variant = 'primary', size = 'md',
  className = '', disabled, onClick, type = 'button'
}) {
  const variants = {
    primary:   'bg-vc-primary text-white hover:bg-vc-accent border border-vc-primary btn-primary',
    secondary: 'bg-transparent text-text-secondary border border-white/[0.08] hover:bg-bg-tertiary hover:text-text-primary',
    ghost:     'bg-transparent text-text-secondary border border-transparent hover:bg-bg-tertiary hover:text-text-primary',
    danger:    'bg-status-danger/10 text-status-danger border border-status-danger/20 hover:bg-status-danger/20',
    success:   'bg-status-success/10 text-status-success border border-status-success/20 hover:bg-status-success/20',
    // Legacy alias
    gold:      'bg-vc-primary text-white hover:bg-vc-accent border border-vc-primary btn-primary',
  }
  const sizes = {
    xs: 'px-2.5 py-1 text-xs',
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-5 py-2.5 text-sm font-semibold',
  }
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 font-medium rounded-btn transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none ${variants[variant] ?? variants.primary} ${sizes[size]} ${className}`}
    >
      {children}
    </button>
  )
}
