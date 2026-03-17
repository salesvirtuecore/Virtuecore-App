import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

export default function AcceptInvite() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [ready, setReady] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    // Supabase puts the session tokens in the URL hash after invite click
    // We need to let Supabase pick them up
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
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

      // Get profile to redirect to correct portal
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
      <div className="min-h-screen flex items-center justify-center bg-vc-secondary">
        <div className="text-center">
          <div className="w-5 h-5 border-2 border-vc-border border-t-gold rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-vc-muted">Setting up your account...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-vc-secondary">
      <div className="bg-white border border-vc-border rounded-md p-8 w-full max-w-sm">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-vc-text">Welcome to VirtueCore</h1>
          <p className="text-sm text-vc-muted mt-1">Set a password to access your portal</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-vc-muted mb-1">New password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="border border-vc-border rounded px-3 py-2 w-full text-sm text-vc-text focus:outline-none focus:border-gold"
              placeholder="At least 8 characters"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-vc-muted mb-1">Confirm password</label>
            <input
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              className="border border-vc-border rounded px-3 py-2 w-full text-sm text-vc-text focus:outline-none focus:border-gold"
              placeholder="Repeat your password"
              required
            />
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="bg-gold hover:bg-gold-dark text-white text-sm px-4 py-2 rounded w-full disabled:opacity-50"
          >
            {loading ? 'Setting password...' : 'Set password & continue'}
          </button>
        </form>
      </div>
    </div>
  )
}
