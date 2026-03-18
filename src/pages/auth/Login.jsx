import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import Button from '../../components/ui/Button'

const DEMO_ACCOUNTS = [
  { label: 'Admin (Samuel)', email: 'sales@virtuecore.co.uk', pw: 'demo1234' },
  { label: 'Client', email: 'client@virtuecore.com', pw: 'demo1234' },
  { label: 'VA', email: 'va@virtuecore.com', pw: 'demo1234' },
]

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login, isDemoMode } = useAuth()
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await login(email, password)
    setLoading(false)
    if (error) {
      setError(error.message)
      return
    }
    navigate('/', { replace: true })
  }

  function quickFill(acc) {
    setEmail(acc.email)
    setPassword(acc.pw)
  }

  return (
    <div className="min-h-screen bg-vc-secondary flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center gap-2 mb-8">
          <div className="w-8 h-8 bg-vc-text flex items-center justify-center">
            <span className="text-gold font-bold">V</span>
          </div>
          <span className="font-semibold text-vc-text text-lg">VirtueCore</span>
        </div>

        <div className="bg-white border border-vc-border p-8">
          <h1 className="text-xl font-semibold text-vc-text mb-1">Sign in</h1>
          <p className="text-sm text-vc-muted mb-6">Access your VirtueCore portal</p>

          {isDemoMode && (
            <div className="mb-6 p-3 bg-amber-50 border border-amber-200">
              <p className="text-xs text-amber-700 font-medium mb-2">Demo mode — no Supabase required</p>
              <div className="flex flex-wrap gap-1.5">
                {DEMO_ACCOUNTS.map((acc) => (
                  <button
                    key={acc.email}
                    onClick={() => quickFill(acc)}
                    className="text-xs px-2.5 py-1 bg-white border border-amber-200 text-amber-700 hover:bg-amber-50 transition-colors rounded"
                  >
                    {acc.label}
                  </button>
                ))}
              </div>
            </div>
          )}

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
            <div>
              <label className="block text-sm text-vc-text mb-1.5 font-medium">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full border border-vc-border px-3 py-2 text-sm text-vc-text placeholder:text-vc-muted focus:outline-none focus:border-vc-text transition-colors"
              />
            </div>

            {error && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-200 px-3 py-2">{error}</p>
            )}

            <Button type="submit" disabled={loading} className="w-full justify-center">
              {loading ? 'Signing in...' : 'Sign in'}
            </Button>
          </form>

          <div className="mt-4 flex justify-between text-xs text-vc-muted">
            <Link to="/forgot-password" className="hover:text-vc-text transition-colors">
              Forgot password?
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
