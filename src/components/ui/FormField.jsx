export default function FormField({ label, error, children, required }) {
  return (
    <div>
      {label && (
        <label className="block text-xs font-medium text-text-secondary mb-1">
          {label}
          {required && <span className="text-status-danger ml-0.5">*</span>}
        </label>
      )}
      {children}
      {error && <p className="text-xs text-status-danger mt-1">{error}</p>}
    </div>
  )
}
