import { createContext, useContext, useState, useEffect } from 'react'
import { supabase, isDemoMode } from '../lib/supabase'
import { DEMO_PROFILES, DEMO_PASSWORD } from '../data/placeholder'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (isDemoMode) {
      // Check for persisted demo session
      const saved = sessionStorage.getItem('vc_demo_profile')
      if (saved) {
        const p = JSON.parse(saved)
        setProfile(p)
        setUser({ id: p.id, email: p.email })
      }
      setLoading(false)
      return
    }

    // Real Supabase auth
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user)
        fetchProfile(session.user.id)
      } else {
        setLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user)
        fetchProfile(session.user.id)
      } else {
        setUser(null)
        setProfile(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function fetchProfile(userId) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    setProfile(data)
    setLoading(false)
  }

  async function login(email, password) {
    if (isDemoMode) {
      const demoProfile = DEMO_PROFILES[email.toLowerCase()]
      if (demoProfile && password === DEMO_PASSWORD) {
        sessionStorage.setItem('vc_demo_profile', JSON.stringify(demoProfile))
        setProfile(demoProfile)
        setUser({ id: demoProfile.id, email: demoProfile.email })
        return { error: null }
      }
      return { error: { message: 'Invalid email or password' } }
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error }
  }

  async function signup(email, password, fullName, role) {
    if (isDemoMode) {
      return { error: { message: 'Signup is disabled in demo mode' } }
    }

    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) return { error }

    if (data.user) {
      await supabase.from('profiles').insert({
        id: data.user.id,
        email,
        full_name: fullName,
        role,
      })
    }

    return { error: null }
  }

  async function logout() {
    if (isDemoMode) {
      sessionStorage.removeItem('vc_demo_profile')
      setUser(null)
      setProfile(null)
      return
    }
    await supabase.auth.signOut()
  }

  async function resetPassword(email) {
    if (isDemoMode) {
      return { error: { message: 'Password reset not available in demo mode' } }
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    return { error }
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, login, signup, logout, resetPassword, isDemoMode }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
