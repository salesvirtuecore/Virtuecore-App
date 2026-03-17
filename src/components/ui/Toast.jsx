import { useEffect } from 'react'
import { X } from 'lucide-react'

export default function Toast({ message, type = 'success', onDismiss }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 3000)
    return () => clearTimeout(timer)
  }, [onDismiss])

  const borderColor = type === 'success' ? 'border-l-green-500' : 'border-l-red-500'

  return (
    <div
      className={`bg-white border border-vc-border border-l-4 ${borderColor} rounded shadow-md px-4 py-3 min-w-[280px] flex items-start gap-3`}
    >
      <p className="text-sm text-vc-text flex-1">{message}</p>
      <button onClick={onDismiss} className="text-vc-muted hover:text-vc-text flex-shrink-0 mt-0.5">
        <X size={14} />
      </button>
    </div>
  )
}
