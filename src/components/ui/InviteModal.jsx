import { useState } from 'react'
import { X } from 'lucide-react'
import { apiFetch } from '../../lib/api'


const PACKAGE_TIERS = ['Starter', 'Growth', 'Premium']

export default function InviteModal({ isOpen, onClose, role, onSuccess }) {
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

      const res = await apiFetch('/api/admin/invite-user', {
        method: 'POST',
        body: JSON.stringify(payload),
      })

      const data = await res.json()

      if (!res.ok) throw new Error(data.error || 'Something went wrong')

      await onSuccess?.(data)
      setSuccess(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const inputClass =
    'bg-bg-tertiary border border-white/[0.08] rounded-btn px-3 py-2 w-full text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-vc-primary focus:ring-1 focus:ring-vc-primary'
  const labelClass = 'block text-xs font-medium text-text-secondary mb-1'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/30"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative bg-bg-elevated border border-white/[0.08] w-full max-w-md mx-4 rounded-card p-6 shadow-elevated">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-text-primary">
            {role === 'client' ? 'Invite Client' : 'Invite VA'}
          </h2>
          <button
            onClick={handleClose}
            className="text-text-secondary hover:text-text-primary transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {success ? (
          <div className="space-y-4">
            <div className="bg-bg-tertiary border border-white/[0.06] rounded-card p-4">
              <p className="text-sm text-text-primary">
                Invite sent to <span className="font-medium">{formData.email}</span>. They'll
                receive an email to set their password and access the portal.
              </p>
            </div>
            <button
              onClick={handleClose}
              className="border border-white/[0.08] text-text-secondary text-sm px-4 py-2 rounded-btn hover:bg-bg-tertiary transition-colors w-full"
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
                className="bg-vc-primary hover:bg-vc-accent text-white text-sm px-4 py-2 rounded-btn disabled:opacity-60 transition-colors flex-1"
              >
                {loading ? 'Sending...' : 'Send Invite'}
              </button>
              <button
                type="button"
                onClick={handleClose}
                className="border border-white/[0.08] text-text-secondary text-sm px-4 py-2 rounded-btn hover:bg-bg-tertiary transition-colors"
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
