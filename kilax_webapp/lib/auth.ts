import { legacySupabase, supabase } from './supabase'

export interface AuthResponse {
  success: boolean
  error?: string
}

// Google Sign In
export async function signInWithGoogle(): Promise<AuthResponse> {
  try {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`
      }
    })
    
    if (error) {
      return { success: false, error: error.message }
    }
    
    return { success: true }
  } catch (_error) {
    return { success: false, error: 'An unexpected error occurred' }
  }
}

// Email Sign Up
export async function signUpWithEmail(email: string, password: string): Promise<AuthResponse> {
  try {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`
      }
    })
    
    if (error) {
      return { success: false, error: error.message }
    }
    
    return { success: true }
  } catch (_error) {
    return { success: false, error: 'An unexpected error occurred' }
  }
}

// Email Sign In
export async function signInWithEmail(email: string, password: string): Promise<AuthResponse> {
  try {
    const normalizedEmail = email.trim().toLowerCase()

    const { error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password
    })

    if (!error) {
      return { success: true }
    }

    try {
      const legacyResult = await legacySupabase.auth.signInWithPassword({
        email: normalizedEmail,
        password
      })

      if (!legacyResult.error) {
        return {
          success: false,
          error: 'This account is on the legacy Supabase project. Please reset the password or migrate the account to the main app database to continue.'
        }
      }
    } catch {
      // Ignore legacy fallback errors; keep the primary auth error.
    }

    return { success: false, error: error.message }
  } catch (_error) {
    return { success: false, error: 'An unexpected error occurred' }
  }
}

// Sign Out
export async function signOut(): Promise<AuthResponse> {
  try {
    const { error } = await supabase.auth.signOut()
    
    if (error) {
      return { success: false, error: error.message }
    }
    
    return { success: true }
  } catch (_error) {
    return { success: false, error: 'An unexpected error occurred' }
  }
}

// Get current user
export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser()
  return user
}