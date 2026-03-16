import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import Button from '../../components/ui/Button'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { resetPassword, isDemoMode } = useAuth()

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
    <div className="min-h-screen bg-vc-secondary flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 mb-8">
          <div className="w-8 h-8 bg-vc-text flex items-center justify-center">
            <span className="text-gold font-bold">V</span>
          </div>
          <span className="font-semibold text-vc-text text-lg">VirtueCore</span>
        </div>

        <div className="bg-white border border-vc-border p-8">
          <h1 className="text-xl font-semibold text-vc-text mb-1">Reset password</h1>
          <p className="text-sm text-vc-muted mb-6">
            Enter your email and we'll send a reset link.
          </p>

          {sent ? (
            <div className="p-3 bg-green-50 border border-green-200 text-sm text-green-700">
              Check your inbox — we've sent a reset link to {email}.
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-vc-text mb-1.5 font-medium">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="you@example.com"
                  className="w-full border border-vc-border px-3 py-2 text-sm text-vc-text placeholder:text-vc-muted focus:outline-none focus:border-vc-text transition-colors"
                />
              </div>

              {error && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-200 px-3 py-2">{error}</p>
              )}

              <Button type="submit" disabled={loading || isDemoMode} className="w-full justify-center">
                {loading ? 'Sending...' : 'Send reset link'}
              </Button>
            </form>
          )}

          <div className="mt-4 text-xs text-vc-muted">
            <Link to="/login" className="hover:text-vc-text transition-colors">
              Back to sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
