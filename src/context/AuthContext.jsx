import { createContext, useContext, useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
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
      .select('id, email, full_name, role, client_id')
      .eq('id', authUser.id)
      .maybeSingle()

    let nextProfile = data

    if (!nextProfile) {
      if (error) {
        console.warn('Profile lookup failed:', error.message)
      }

      const metaRole = authUser?.user_metadata?.role
      if (metaRole && metaRole !== 'client') {
        nextProfile = {
          id: authUser.id,
          email: authUser.email,
          full_name: authUser?.user_metadata?.full_name || '',
          role: metaRole,
        }
      } else {
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
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error }
  }

  async function signup(email, password, fullName, role) {
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
    await supabase.auth.signOut()
  }

  async function resetPassword(email) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    return { error }
  }

  const value = useMemo(
    () => ({ user, profile, loading, login, signup, logout, resetPassword }),
    [user, profile, loading]
  )

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
