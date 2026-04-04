import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import Button from '../../components/ui/Button'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { resetPassword } = useAuth()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await resetPassword(email)
    setLoading(false)
    if (error) {
      setError(error.message)
      return
    }
    setSent(true)
  }

  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 mb-8">
          <div className="w-8 h-8 bg-vc-primary rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">V</span>
          </div>
          <span className="font-semibold text-text-primary text-lg font-heading">VirtueCore</span>
        </div>

        <div className="bg-bg-elevated border border-white/[0.08] rounded-card p-8">
          <h1 className="text-xl font-semibold text-text-primary mb-1 font-heading">Reset password</h1>
          <p className="text-sm text-text-secondary mb-6">
            Enter your email and we'll send a reset link.
          </p>

          {sent ? (
            <div className="p-3 bg-status-success/10 border border-status-success/20 rounded text-sm text-status-success">
              Check your inbox — we've sent a reset link to {email}.
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-text-primary mb-1.5 font-medium">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="you@example.com"
                  className="w-full bg-bg-tertiary border border-white/[0.08] rounded-btn px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-vc-primary focus:ring-1 focus:ring-vc-primary transition-colors"
                />
              </div>

              {error && (
                <p className="text-xs text-status-danger bg-status-danger/10 border border-status-danger/20 px-3 py-2 rounded">{error}</p>
              )}

              <Button type="submit" disabled={loading} className="w-full justify-center">
                {loading ? 'Sending...' : 'Send reset link'}
              </Button>
            </form>
          )}

          <div className="mt-4 text-xs text-text-secondary">
            <Link to="/login" className="hover:text-text-primary transition-colors">
              Back to sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
