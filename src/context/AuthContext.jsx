import { createContext, useContext, useState, useEffect } from 'react'
import { supabase, isDemoMode } from '../lib/supabase'
import { DEMO_PROFILES, DEMO_PASSWORD } from '../data/placeholder'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Support demo override even when Supabase is configured
    const demoOverride = sessionStorage.getItem('vc_demo_override')
    if (isDemoMode || demoOverride) {
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
        fetchProfile(session.user, session.access_token)
      } else {
        setLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user)
        fetchProfile(session.user, session.access_token)
      } else {
        setUser(null)
        setProfile(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function syncClientAccess(accessToken) {
    if (!accessToken) return null

    try {
      const response = await fetch('/api/client/claim', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })

      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to sync client access')
      }

      return payload
    } catch (error) {
      console.warn('Client access sync failed:', error.message)
      return null
    }
  }

  async function fetchProfile(authUser, accessToken) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authUser.id)
      .maybeSingle()

    let nextProfile = data

    if (!nextProfile) {
      if (error) {
        console.warn('Profile lookup failed:', error.message)
      }

      // Check auth metadata for a role (set during VA/client signup)
      const metaRole = authUser?.user_metadata?.role
      if (metaRole && metaRole !== 'client') {
        // VA or other non-client role from metadata — use it, no sync needed
        nextProfile = {
          id: authUser.id,
          email: authUser.email,
          full_name: authUser?.user_metadata?.full_name || '',
          role: metaRole,
        }
      } else {
        // No profile row, might be a new client — try to sync/claim
        const syncResult = await syncClientAccess(accessToken)
        if (syncResult?.profile) {
          nextProfile = {
            id: authUser.id,
            email: authUser.email,
            full_name: authUser?.user_metadata?.full_name || '',
            role: 'client',
            ...syncResult.profile,
          }
        } else {
          // No profile, no client record — this account has no access, sign them out
          await supabase.auth.signOut()
          setUser(null)
          setProfile(null)
          setLoading(false)
          return
        }
      }
    }

    const effectiveRole = nextProfile?.role || 'client'
    if (effectiveRole === 'client' && !nextProfile.client_id) {
      const syncResult = await syncClientAccess(accessToken)
      if (syncResult?.profile) {
        nextProfile = { ...nextProfile, ...syncResult.profile }
      }
    }

    setProfile(nextProfile)
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

  // Allows previewing any demo role even when Supabase is configured
  function loginAsDemo(role = 'client') {
    const emailMap = { client: 'client@virtuecore.com', admin: 'sales@virtuecore.co.uk', va: 'va@virtuecore.com' }
    const demoProfile = DEMO_PROFILES[emailMap[role]]
    if (!demoProfile) return
    sessionStorage.setItem('vc_demo_profile', JSON.stringify(demoProfile))
    sessionStorage.setItem('vc_demo_override', '1')
    setProfile(demoProfile)
    setUser({ id: demoProfile.id, email: demoProfile.email })
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
    <AuthContext.Provider value={{ user, profile, loading, login, loginAsDemo, signup, logout, resetPassword, isDemoMode }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
