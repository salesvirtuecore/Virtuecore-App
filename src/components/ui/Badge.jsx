export default function Badge({ children, variant = 'default', size = 'sm' }) {
  const variants = {
    default: 'bg-gray-100 text-gray-700',
    green: 'bg-green-50 text-green-700',
    amber: 'bg-amber-50 text-amber-700',
    red: 'bg-red-50 text-red-700',
    gold: 'bg-amber-50 text-amber-700',
    blue: 'bg-blue-50 text-blue-700',
    purple: 'bg-purple-50 text-purple-700',
  }
  const sizes = {
    xs: 'px-1.5 py-0.5 text-xs',
    sm: 'px-2 py-0.5 text-xs font-medium',
    md: 'px-2.5 py-1 text-sm font-medium',
  }
  return (
    <span className={`inline-flex items-center rounded ${variants[variant]} ${sizes[size]}`}>
      {children}
    </span>
  )
}
