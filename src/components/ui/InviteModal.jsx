import { useState } from 'react'
import { X } from 'lucide-react'
import { isDemoMode } from '../../lib/supabase'

const PACKAGE_TIERS = ['Starter', 'Growth', 'Premium']

export default function InviteModal({ isOpen, onClose, role }) {
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    company_name: '',
    package_tier: 'Starter',
    monthly_retainer: '',
    revenue_share_percentage: '',
  })
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState(null)

  if (!isOpen) return null

  function handleChange(e) {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  function handleClose() {
    setFormData({
      full_name: '',
      email: '',
      company_name: '',
      package_tier: 'Starter',
      monthly_retainer: '',
      revenue_share_percentage: '',
    })
    setLoading(false)
    setSuccess(false)
    setError(null)
    onClose()
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    if (isDemoMode) {
      await new Promise((r) => setTimeout(r, 800))
      setLoading(false)
      setSuccess(true)
      return
    }

    try {
      const payload = {
        email: formData.email,
        full_name: formData.full_name,
        role,
        ...(role === 'client' && {
          company_name: formData.company_name,
          package_tier: formData.package_tier,
          monthly_retainer: formData.monthly_retainer ? Number(formData.monthly_retainer) : 0,
          revenue_share_percentage: formData.revenue_share_percentage
            ? Number(formData.revenue_share_percentage)
            : 0,
        }),
      }

      const res = await fetch('/api/invite-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()

      if (!res.ok) throw new Error(data.error || 'Something went wrong')

      setSuccess(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const inputClass =
    'border border-vc-border rounded px-3 py-2 w-full text-sm text-vc-text focus:outline-none focus:border-gold'
  const labelClass = 'block text-xs font-medium text-vc-muted mb-1'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/30"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative bg-white w-full max-w-md mx-4 rounded p-6 shadow-sm">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-vc-text">
            {role === 'client' ? 'Invite Client' : 'Invite VA'}
          </h2>
          <button
            onClick={handleClose}
            className="text-vc-muted hover:text-vc-text transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {success ? (
          <div className="space-y-4">
            <div className="bg-vc-secondary border border-vc-border rounded p-4">
              {isDemoMode ? (
                <p className="text-sm text-vc-text">
                  In live mode, this would send an invite email to{' '}
                  <span className="font-medium">{formData.email}</span>.
                </p>
              ) : (
                <p className="text-sm text-vc-text">
                  Invite sent to <span className="font-medium">{formData.email}</span>. They'll
                  receive an email to set their password and access the portal.
                </p>
              )}
            </div>
            <button
              onClick={handleClose}
              className="border border-vc-border text-vc-text text-sm px-4 py-2 rounded hover:bg-vc-secondary w-full"
            >
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Full Name */}
            <div>
              <label className={labelClass}>Full Name</label>
              <input
                type="text"
                name="full_name"
                value={formData.full_name}
                onChange={handleChange}
                required
                placeholder="Jane Smith"
                className={inputClass}
              />
            </div>

            {/* Email */}
            <div>
              <label className={labelClass}>Email</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                placeholder="jane@example.com"
                className={inputClass}
              />
            </div>

            {/* Client-only fields */}
            {role === 'client' && (
              <>
                <div>
                  <label className={labelClass}>Company Name</label>
                  <input
                    type="text"
                    name="company_name"
                    value={formData.company_name}
                    onChange={handleChange}
                    placeholder="Acme Ltd"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>Package Tier</label>
                  <select
                    name="package_tier"
                    value={formData.package_tier}
                    onChange={handleChange}
                    className={inputClass}
                  >
                    {PACKAGE_TIERS.map((tier) => (
                      <option key={tier} value={tier}>
                        {tier}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Monthly Retainer (£)</label>
                    <input
                      type="number"
                      name="monthly_retainer"
                      value={formData.monthly_retainer}
                      onChange={handleChange}
                      placeholder="2500"
                      min="0"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Revenue Share (%)</label>
                    <input
                      type="number"
                      name="revenue_share_percentage"
                      value={formData.revenue_share_percentage}
                      onChange={handleChange}
                      placeholder="10"
                      min="0"
                      max="100"
                      className={inputClass}
                    />
                  </div>
                </div>
              </>
            )}

            {error && (
              <p className="text-xs text-red-600 border border-red-200 bg-red-50 rounded px-3 py-2">
                {error}
              </p>
            )}

            <div className="flex items-center gap-3 pt-1">
              <button
                type="submit"
                disabled={loading}
                className="bg-gold hover:bg-gold-dark text-white text-sm px-4 py-2 rounded disabled:opacity-60 flex-1"
              >
                {loading ? 'Sending...' : 'Send Invite'}
              </button>
              <button
                type="button"
                onClick={handleClose}
                className="border border-vc-border text-vc-text text-sm px-4 py-2 rounded hover:bg-vc-secondary"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
