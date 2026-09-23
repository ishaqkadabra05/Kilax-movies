'use client'

import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { User } from '@supabase/supabase-js'
import { legacySupabase, supabase } from '@/lib/supabase'
import { userHasActivePaidSubscription } from '@/lib/subscriptions'

interface AuthContextType {
  user: User | null
  loading: boolean
  isPremium: boolean
  signIn: (email: string, password: string) => Promise<{ error: Error | null; legacyPasswordResetRequired?: boolean }>
  signUp: (email: string, password: string, phone?: string, avatarUrl?: string) => Promise<{ error: Error | null }>
  signInWithGoogle: () => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<{ error: Error | null }>
  updatePassword: (password: string) => Promise<{ error: Error | null }>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [isPremium, setIsPremium] = useState(false)
  const lastPremiumCheckUserId = useRef<string | null>(null)

  const checkPremiumStatus = async (currentUser: User | null) => {
    if (!currentUser) {
      lastPremiumCheckUserId.current = null
      setIsPremium(false)
      return
    }

    const currentUserId = currentUser.id
    if (lastPremiumCheckUserId.current === currentUserId) {
      return
    }

    lastPremiumCheckUserId.current = currentUserId

    try {
      const hasActivePaidSubscription = await userHasActivePaidSubscription(currentUserId)
      setIsPremium(hasActivePaidSubscription)
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Error checking premium status:', error)
      }
      setIsPremium(false)
    }
  }

  useEffect(() => {
    const loadingTimeout = setTimeout(() => {
      setLoading(false)
    }, 10000)

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setUser(session?.user ?? null)

      if (session?.user) {
        void checkPremiumStatus(session.user)
      }

      setLoading(false)
      clearTimeout(loadingTimeout)
    }).catch((error) => {
      if (process.env.NODE_ENV !== 'production') {
        console.error('AuthProvider: Error getting session:', error)
      }
      setLoading(false)
      clearTimeout(loadingTimeout)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        const nextUser = session?.user ?? null
        setUser(nextUser)

        if (nextUser && event !== 'SIGNED_OUT') {
          void checkPremiumStatus(nextUser)
        } else {
          lastPremiumCheckUserId.current = null
          setIsPremium(false)
        }

        setLoading(false)
        clearTimeout(loadingTimeout)
      }
    )

    return () => {
      subscription.unsubscribe()
      clearTimeout(loadingTimeout)
    }
  }, [])

  const signIn = async (email: string, password: string) => {
    const normalizedEmail = email.trim().toLowerCase()

    const { error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    })

    if (!error) {
      return { error: null }
    }

    try {
      const legacyResult = await legacySupabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      })

      if (!legacyResult.error) {
        return {
          error: new Error('This account is on the legacy Supabase project. Please reset the password or migrate the account to the main app database to continue.'),
          legacyPasswordResetRequired: true,
        }
      }
    } catch {
      // Ignore legacy auth failures and fall back to the primary auth error.
    }

    try {
      const result = await supabase
        .from('profiles')
        .select('id, email')
        .ilike('email', normalizedEmail)
        .maybeSingle() as { data: { email?: string | null } | null; error: Error | null }

      if (!result.error && result.data?.email) {
        return {
          error: new Error('Your migrated account requires a password reset before premium access can be restored.'),
          legacyPasswordResetRequired: true,
        }
      }
    } catch {
      // Ignore profile lookup failures and fall back to the original auth error.
    }

    return { error }
  }

  const signUp = async (email: string, password: string, phone?: string, avatarUrl?: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // Store phone in metadata so the handle_new_user trigger copies it
        // to profiles.phone on insert. full_name can be set later on profile edit.
        data: phone || avatarUrl ? { ...(phone ? { phone } : {}), ...(avatarUrl ? { avatar_url: avatarUrl } : {}) } : undefined,
      },
    })
    return { error }
  }

  const signInWithGoogle = async () => {
    // Use the canonical redirect URL - must match Supabase OAuth settings exactly
    let redirectUrl = `${window.location.origin}/auth/callback`
    
    // For production environments with custom domains, ensure the URL is correct
    // Remove trailing slashes and normalize
    redirectUrl = redirectUrl.replace(/\/$/, '')

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent'
          }
        }
      })
      return { error }
    } catch (err) {
      return { error: err instanceof Error ? err : new Error('Unknown error') }
    }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  const resetPassword = async (email: string) => {
    const resetUrl = new URL('/reset-password', window.location.origin).toString()
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: resetUrl,
    })
    return { error }
  }

  const updatePassword = async (password: string) => {
    const { error } = await supabase.auth.updateUser({
      password: password,
    })
    return { error }
  }

  const value = {
    user,
    loading,
    isPremium,
    signIn,
    signUp,
    signInWithGoogle,
    signOut,
    resetPassword,
    updatePassword,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}