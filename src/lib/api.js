import { supabase } from './supabase'

// Authenticated fetch wrapper — automatically attaches Bearer token
export async function apiFetch(url, options = {}) {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token

  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  return fetch(url, { ...options, headers })
}
