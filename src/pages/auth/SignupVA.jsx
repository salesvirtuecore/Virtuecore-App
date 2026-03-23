import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

export default function SignupVA() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const navigate = useNavigate()

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
          data: { full_name: fullName, role: 'va' },
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
        await fetch('/api/admin/register-va', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: userId, email, full_name: fullName }),
        })
      }

      setDone(true)
      setTimeout(() => navigate('/va'), 1500)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-vc-sidebar">
        <div className="bg-white border border-white/10 p-8 w-full max-w-sm text-center">
          <div className="w-8 h-8 bg-green-100 flex items-center justify-center mx-auto mb-3">
            <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-sm font-medium text-white">Account created — taking you to your VA portal</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-vc-sidebar">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center gap-2 justify-center mb-8">
          <div className="w-8 h-8 bg-gold flex items-center justify-center">
            <span className="text-white font-bold">V</span>
          </div>
          <span className="text-white font-semibold tracking-wide">VirtueCore</span>
        </div>

        <div className="bg-white/5 border border-white/10 p-8">
          <div className="mb-6">
            <h1 className="text-xl font-semibold text-white">Join as a Virtual Assistant</h1>
            <p className="text-sm text-white/60 mt-1">Create your account to access your task board, time tracker, and team tools.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-white/60 mb-1">Full name</label>
              <input
                type="text"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                className="border border-white/10 bg-white/5 text-white placeholder-white/30 px-3 py-2 w-full text-sm focus:outline-none focus:border-gold"
                placeholder="Jane Smith"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-white/60 mb-1">Email address</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="border border-white/10 bg-white/5 text-white placeholder-white/30 px-3 py-2 w-full text-sm focus:outline-none focus:border-gold"
                placeholder="you@email.com"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-white/60 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="border border-white/10 bg-white/5 text-white placeholder-white/30 px-3 py-2 w-full text-sm focus:outline-none focus:border-gold"
                placeholder="At least 8 characters"
                required
              />
            </div>

            {error && <p className="text-xs text-red-400">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="bg-gold hover:bg-gold-dark text-white text-sm px-4 py-2 w-full disabled:opacity-50 font-medium"
            >
              {loading ? 'Creating account…' : 'Create VA account'}
            </button>
          </form>

          <p className="text-xs text-white/40 text-center mt-4">
            Already have an account?{' '}
            <a href="/login" className="text-gold hover:underline">Sign in</a>
          </p>
        </div>

        <p className="text-xs text-white/30 text-center mt-4">
          This invite link is for Virtual Assistants only.
        </p>
      </div>
    </div>
  )
}
