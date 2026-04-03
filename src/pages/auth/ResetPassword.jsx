import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

export default function ResetPassword() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [ready, setReady] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === 'SIGNED_IN' || event === 'PASSWORD_RECOVERY') && session) {
        setReady(true)
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) throw updateError

      const { data: { user } } = await supabase.auth.getUser()
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      const routes = { admin: '/admin', client: '/client', va: '/va' }
      navigate(routes[profile?.role] ?? '/login', { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-primary">
        <div className="text-center">
          <div className="w-5 h-5 border-2 border-white/[0.08] border-t-vc-primary rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-text-secondary">Verifying your reset link...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-primary p-4">
      <div className="bg-bg-elevated border border-white/[0.08] rounded-card p-8 w-full max-w-sm">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-text-primary font-heading">Reset your password</h1>
          <p className="text-sm text-text-secondary mt-1">Enter a new password for your account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">New password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="bg-bg-tertiary border border-white/[0.08] rounded-btn px-3 py-2 w-full text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-vc-primary focus:ring-1 focus:ring-vc-primary"
              placeholder="At least 8 characters"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Confirm password</label>
            <input
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              className="bg-bg-tertiary border border-white/[0.08] rounded-btn px-3 py-2 w-full text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-vc-primary focus:ring-1 focus:ring-vc-primary"
              placeholder="Repeat your password"
              required
            />
          </div>

          {error && <p className="text-xs text-status-danger">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="bg-vc-primary hover:bg-vc-accent text-white text-sm px-4 py-2 rounded-btn w-full disabled:opacity-50 font-medium transition-colors"
          >
            {loading ? 'Updating password...' : 'Update password'}
          </button>
        </form>
      </div>
    </div>
  )
}
