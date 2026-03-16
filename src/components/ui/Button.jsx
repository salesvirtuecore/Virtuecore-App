export default function Button({ children, variant = 'primary', size = 'md', className = '', disabled, onClick, type = 'button' }) {
  const variants = {
    primary: 'bg-vc-text text-white hover:bg-gray-800 border border-vc-text',
    secondary: 'bg-white text-vc-text border border-vc-border hover:bg-vc-secondary',
    gold: 'bg-gold text-white hover:bg-gold-dark border border-gold',
    ghost: 'bg-transparent text-vc-muted hover:text-vc-text hover:bg-vc-secondary border border-transparent',
    danger: 'bg-red-600 text-white hover:bg-red-700 border border-red-600',
  }
  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-5 py-2.5 text-base',
  }
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 font-medium transition-colors rounded disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {children}
    </button>
  )
}
