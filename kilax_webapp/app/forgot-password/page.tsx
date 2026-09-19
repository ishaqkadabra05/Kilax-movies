'use client'

import { FormEvent, useState } from 'react'
import Link from 'next/link'
import { Mail, ArrowLeft, CheckCircle, LockKeyhole } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/components/AuthProvider'
import { isValidEmail } from '@/lib/validation'

export default function ForgotPasswordPage() {
  const { resetPassword } = useAuth()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    if (!isValidEmail(email)) {
      setError('Please enter a valid email address, for example samplemail@gmail.com.')
      return
    }
    setLoading(true)
    const { error: resetError } = await resetPassword(email.trim().toLowerCase())
    setLoading(false)
    if (resetError) {
      setError(resetError.message || 'Unable to send the password reset email. Please try again.')
      return
    }
    setSent(true)
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-950 via-black to-gray-900 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="bg-gray-900/90 border border-gray-800 rounded-2xl p-7 shadow-2xl">
          <div className="flex justify-center mb-5"><img src="/logo.png" alt="Kilax Movies" width={56} height={56} className="w-14 h-14 rounded-xl object-contain" /></div>
          {sent ? (
            <div className="text-center space-y-5">
              <div className="mx-auto w-14 h-14 rounded-full bg-green-500/10 flex items-center justify-center"><CheckCircle className="w-7 h-7 text-green-400" /></div>
              <div>
                <h1 className="text-2xl font-bold text-white">Check your email</h1>
                <p className="text-gray-400 text-sm mt-2">If an account exists for <span className="text-white">{email.trim()}</span>, a password reset link has been sent.</p>
              </div>
              <Link href="/signin" className="inline-flex items-center justify-center w-full rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3">Back to Sign In</Link>
            </div>
          ) : (
            <>
              <div className="text-center mb-7">
                <div className="inline-flex items-center gap-2 text-orange-400 text-sm font-semibold mb-2"><LockKeyhole className="w-4 h-4" /> Password recovery</div>
                <h1 className="text-2xl font-bold text-white">Forgot your password?</h1>
                <p className="text-gray-400 text-sm mt-2">Enter your email and we'll send you a secure reset link.</p>
              </div>
              {error && <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">{error}</div>}
              <form onSubmit={submit} className="space-y-4">
                <div className="relative"><Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" /><Input type="email" inputMode="email" autoComplete="email" placeholder="samplemail@gmail.com" value={email} onChange={e => setEmail(e.target.value)} disabled={loading} required className="pl-11 h-12 bg-gray-800 border-gray-700 text-white placeholder-gray-500" /></div>
                <Button type="submit" disabled={loading} className="w-full h-12 bg-orange-500 hover:bg-orange-600 text-white font-semibold">{loading ? 'Sending reset link...' : 'Send Reset Link'}</Button>
              </form>
              <Link href="/signin" className="mt-6 inline-flex w-full items-center justify-center gap-2 text-sm text-gray-400 hover:text-white"><ArrowLeft className="w-4 h-4" /> Back to Sign In</Link>
            </>
          )}
        </div>
      </div>
    </main>
  )
}
