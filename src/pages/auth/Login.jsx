import { useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import Button from '../../components/ui/Button'

const DEMO_ACCOUNTS = [
  { label: 'Admin (Samuel)', email: 'sales@virtuecore.co.uk', pw: 'demo1234' },
  { label: 'Client', email: 'client@virtuecore.com', pw: 'demo1234' },
  { label: 'VA', email: 'va@virtuecore.com', pw: 'demo1234' },
]

export default function Login() {
  const [searchParams] = useSearchParams()
  const [email, setEmail] = useState(searchParams.get('email') ?? '')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(searchParams.get('email') ? 'You already have an account — sign in below.' : '')
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
    <div className="min-h-screen bg-bg-primary flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center gap-2 mb-8">
          <div className="w-8 h-8 bg-vc-primary rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">V</span>
          </div>
          <span className="font-semibold text-text-primary text-lg font-heading">VirtueCore</span>
        </div>

        <div className="bg-bg-elevated border border-white/[0.08] rounded-card p-8">
          <h1 className="text-xl font-semibold text-text-primary mb-1 font-heading">Sign in</h1>
          <p className="text-sm text-text-secondary mb-6">Access your VirtueCore portal</p>

          {isDemoMode && (
            <div className="mb-6 p-3 bg-status-warning/10 border border-status-warning/20 rounded-card">
              <p className="text-xs text-status-warning font-medium mb-2">Demo mode — no Supabase required</p>
              <div className="flex flex-wrap gap-1.5">
                {DEMO_ACCOUNTS.map((acc) => (
                  <button
                    key={acc.email}
                    onClick={() => quickFill(acc)}
                    className="text-xs px-2.5 py-1 bg-bg-tertiary border border-white/[0.08] text-text-secondary hover:text-text-primary hover:border-white/[0.16] transition-colors rounded-btn"
                  >
                    {acc.label}
                  </button>
                ))}
              </div>
            </div>
          )}

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
            <div>
              <label className="block text-sm text-text-primary mb-1.5 font-medium">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full bg-bg-tertiary border border-white/[0.08] rounded-btn px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-vc-primary focus:ring-1 focus:ring-vc-primary transition-colors"
              />
            </div>

            {error && (
              <p className={`text-xs px-3 py-2 rounded border ${searchParams.get('email') ? 'text-status-info bg-status-info/10 border-status-info/20' : 'text-status-danger bg-status-danger/10 border-status-danger/20'}`}>{error}</p>
            )}

            <Button type="submit" disabled={loading} className="w-full justify-center">
              {loading ? 'Signing in...' : 'Sign in'}
            </Button>
          </form>

          <div className="mt-4 flex justify-between text-xs text-text-secondary">
            <Link to="/forgot-password" className="hover:text-text-primary transition-colors">
              Forgot password?
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
