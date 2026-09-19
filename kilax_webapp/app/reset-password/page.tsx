'use client'

import { FormEvent, useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertCircle, ArrowLeft, CheckCircle, Eye, EyeOff, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { isValidPassword } from '@/lib/validation'
import { supabase } from '@/lib/supabase'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [ready, setReady] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let mounted = true
    const prepareRecoverySession = async () => {
      try {
        const url = new URL(window.location.href)
        const errorDescription = url.searchParams.get('error_description')
        if (errorDescription) throw new Error(decodeURIComponent(errorDescription.replace(/\+/g, ' ')))

        const code = url.searchParams.get('code')
        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
          if (exchangeError) throw exchangeError
        }

        const tokenHash = url.searchParams.get('token_hash')
        if (tokenHash && url.searchParams.get('type') === 'recovery') {
          const { error: verifyError } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'recovery' })
          if (verifyError) throw verifyError
        }

        // Support older Supabase links that place the recovery session in the URL hash.
        if (window.location.hash) {
          const hash = new URLSearchParams(window.location.hash.slice(1))
          const accessToken = hash.get('access_token')
          const refreshToken = hash.get('refresh_token')
          if (accessToken && refreshToken) {
            const { error: sessionError } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
            if (sessionError) throw sessionError
          }
        }

        const { data: { session } } = await supabase.auth.getSession()
        if (!session) throw new Error('This password reset link is invalid or has expired. Please request a new one.')
        if (mounted) setReady(true)
      } catch (err) {
        if (mounted) setError(err instanceof Error ? err.message : 'This password reset link is invalid or has expired.')
      } finally {
        if (mounted) setLoading(false)
      }
    }

    prepareRecoverySession()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' && session && mounted) {
        setReady(true)
        setLoading(false)
      }
    })

    return () => { mounted = false; subscription.unsubscribe() }
  }, [])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    if (!isValidPassword(password)) { setError('Password must be at least 6 characters.'); return }
    if (password !== confirmPassword) { setError('Passwords do not match.'); return }

    setSaving(true)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    if (updateError) {
      setError(updateError.message || 'Failed to update your password.')
      setSaving(false)
      return
    }
    await supabase.auth.signOut()
    setSuccess(true)
    setSaving(false)
  }

  if (loading) return <main className="min-h-screen bg-black flex items-center justify-center"><div className="animate-spin rounded-full h-9 w-9 border-2 border-orange-500 border-t-transparent" /></main>

  if (success) return (
    <main className="min-h-screen bg-gradient-to-br from-gray-950 via-black to-gray-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-gray-800 bg-gray-900 p-8 text-center shadow-2xl">
        <CheckCircle className="mx-auto h-14 w-14 text-green-400" />
        <h1 className="mt-5 text-2xl font-bold text-white">Password Reset Successful</h1>
        <p className="mt-2 text-gray-400">Your Kilax password has been changed. Sign in with your new password.</p>
        <Link href="/signin" className="mt-6 inline-flex w-full justify-center rounded-lg bg-orange-500 py-3 font-semibold text-white hover:bg-orange-600">Go to Sign In</Link>
      </div>
    </main>
  )

  if (!ready) return (
    <main className="min-h-screen bg-gradient-to-br from-gray-950 via-black to-gray-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-gray-800 bg-gray-900 p-8 text-center shadow-2xl">
        <AlertCircle className="mx-auto h-14 w-14 text-red-400" />
        <h1 className="mt-5 text-2xl font-bold text-white">Invalid Reset Link</h1>
        <p className="mt-2 text-gray-400">{error || 'This password reset link is invalid or has expired.'}</p>
        <Link href="/forgot-password" className="mt-6 inline-flex w-full justify-center rounded-lg bg-orange-500 py-3 font-semibold text-white hover:bg-orange-600">Request a New Link</Link>
      </div>
    </main>
  )

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-950 via-black to-gray-900 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-gray-800 bg-gray-900 p-7 shadow-2xl">
        <div className="flex justify-center mb-5"><img src="/logo.png" alt="Kilax Movies" width={56} height={56} className="w-14 h-14 rounded-xl object-contain" /></div>
        <div className="text-center mb-7"><div className="inline-flex items-center gap-2 text-orange-400 text-sm font-semibold"><Lock className="w-4 h-4" /> Password Reset</div><h1 className="mt-2 text-2xl font-bold text-white">Create a New Password</h1><p className="mt-2 text-gray-400 text-sm">Your new password must contain at least 6 characters.</p></div>
        {error && <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">{error}</div>}
        <form onSubmit={submit} className="space-y-4">
          <div className="relative"><Input type={showPassword ? 'text' : 'password'} autoComplete="new-password" minLength={6} placeholder="New password (minimum 6 characters)" value={password} onChange={e=>setPassword(e.target.value)} disabled={saving} required className="h-12 bg-gray-800 border-gray-700 text-white pr-12 placeholder-gray-500"/><button type="button" onClick={()=>setShowPassword(v=>!v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white">{showPassword?<EyeOff className="w-5 h-5"/>:<Eye className="w-5 h-5"/>}</button></div>
          <div className="relative"><Input type={showConfirmPassword ? 'text' : 'password'} autoComplete="new-password" minLength={6} placeholder="Confirm new password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} disabled={saving} required className="h-12 bg-gray-800 border-gray-700 text-white pr-12 placeholder-gray-500"/><button type="button" onClick={()=>setShowConfirmPassword(v=>!v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white">{showConfirmPassword?<EyeOff className="w-5 h-5"/>:<Eye className="w-5 h-5"/>}</button></div>
          <Button type="submit" disabled={saving} className="w-full h-12 bg-orange-500 hover:bg-orange-600 text-white font-semibold">{saving ? 'Updating password...' : 'Update Password'}</Button>
        </form>
        <Link href="/" className="mt-6 inline-flex w-full items-center justify-center gap-2 text-sm text-gray-500 hover:text-white"><ArrowLeft className="w-4 h-4"/> Back to Home</Link>
      </div>
    </main>
  )
}
