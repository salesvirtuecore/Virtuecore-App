import { X } from 'lucide-react'
import { useEffect } from 'react'

const SIZE_CLASSES = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-2xl',
}

export default function Modal({ isOpen, onClose, title, children, size = 'md' }) {
  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return
    function handleKey(e) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className={`bg-white w-full ${SIZE_CLASSES[size]} rounded-md border border-vc-border shadow-sm flex flex-col`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-vc-border flex-shrink-0">
          <h2 className="text-sm font-semibold text-vc-text">{title}</h2>
          <button
            onClick={onClose}
            className="text-vc-muted hover:text-vc-text transition-colors"
          >
            <X size={16} />
          </button>
        </div>
        {/* Body */}
        <div className="overflow-y-auto max-h-[80vh] px-6 py-4">
          {children}
        </div>
      </div>
    </div>
  )
}
