import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

const VALID_ROLES = ['client', 'va', 'admin']
const PORTAL_ROUTES = { admin: '/admin', client: '/client', va: '/va' }

export default function Signup() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const rawRole = searchParams.get('role')
  const role = VALID_ROLES.includes(rawRole) ? rawRole : 'client'
  const portalRoute = PORTAL_ROUTES[role]
  const roleLabel = role === 'va' ? 'VA' : role === 'admin' ? 'admin' : 'client'

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (!fullName.trim()) return setError('Please enter your full name')
    if (password.length < 8) return setError('Password must be at least 8 characters')

    setLoading(true)
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName, role },
        },
      })

      if (signUpError) {
        if (signUpError.message?.toLowerCase().includes('already registered')) {
          navigate(`/login?email=${encodeURIComponent(email)}`)
          return
        }
        throw signUpError
      }

      const userId = data?.user?.id
      if (userId) {
        await supabase.from('profiles').upsert({
          id: userId,
          email,
          full_name: fullName,
          role,
        }, { onConflict: 'id' })
      }

      setDone(true)
      setTimeout(() => navigate(portalRoute), 1500)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-primary">
        <div className="bg-bg-elevated border border-white/[0.08] rounded-card p-8 w-full max-w-sm text-center">
          <div className="w-8 h-8 bg-status-success/10 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-4 h-4 text-status-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-sm font-medium text-text-primary">Account created — taking you to your {roleLabel} portal</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-primary p-4">
      <div className="bg-bg-elevated border border-white/[0.08] rounded-card p-8 w-full max-w-sm">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-text-primary font-heading">Create your account</h1>
          <p className="text-sm text-text-secondary mt-1">Access your VirtueCore {roleLabel} portal</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Full name</label>
            <input
              type="text"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              className="bg-bg-tertiary border border-white/[0.08] rounded-btn px-3 py-2 w-full text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-vc-primary focus:ring-1 focus:ring-vc-primary"
              placeholder="Jane Smith"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Email address</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="bg-bg-tertiary border border-white/[0.08] rounded-btn px-3 py-2 w-full text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-vc-primary focus:ring-1 focus:ring-vc-primary"
              placeholder="you@company.com"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="bg-bg-tertiary border border-white/[0.08] rounded-btn px-3 py-2 w-full text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-vc-primary focus:ring-1 focus:ring-vc-primary"
              placeholder="At least 8 characters"
              required
            />
          </div>

          {error && <p className="text-xs text-status-danger">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="bg-vc-primary hover:bg-vc-accent text-white text-sm px-4 py-2 rounded-btn w-full disabled:opacity-50 font-medium transition-colors"
          >
            {loading ? 'Creating account...' : 'Create account'}
          </button>
        </form>

        <p className="text-xs text-text-tertiary text-center mt-4">
          Already have an account?{' '}
          <a href="/login" className="text-vc-accent hover:text-vc-primary transition-colors">Sign in</a>
        </p>
      </div>
    </div>
  )
}
