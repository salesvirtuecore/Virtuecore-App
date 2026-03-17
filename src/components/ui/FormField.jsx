export default function FormField({ label, error, children, required }) {
  return (
    <div>
      {label && (
        <label className="block text-xs font-medium text-vc-muted mb-1">
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}
      {children}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  )
}
