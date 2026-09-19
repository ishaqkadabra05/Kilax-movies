'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { useRouter, useSearchParams } from 'next/navigation';
import { getRedirectCookie, setRedirectCookie, clearRedirectCookie } from '@/lib/utils';
import RecaptchaGuard, {
  getRecaptchaToken,
  verifyRecaptchaToken,
  annotateAssessment,
} from '@/components/RecaptchaGuard';
import PasswordInput from '@/components/PasswordInput';

export default function SignInContent() {
  const [email,       setEmail]       = useState('');
  const [password,    setPassword]    = useState('');
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');
  const [message,     setMessage]     = useState('');
  const [redirecting, setRedirecting] = useState(false);

  const router       = useRouter();
  const searchParams = useSearchParams();
  const { signIn, signInWithGoogle, user } = useAuth();

  /* ── query-param messages ──────────────────────────────── */
  useEffect(() => {
    const e = searchParams.get('error');
    const m = searchParams.get('message');
    const r = searchParams.get('redirect');
    if (e === 'auth_failed')   setError('Authentication failed. Please try again.');
    else if (e === 'unexpected') setError('An unexpected error occurred. Please try again.');
    if (m === 'check_email')
      setMessage('Please check your email and click the confirmation link to complete registration.');
    if (r && !getRedirectCookie()) setRedirectCookie(r);
  }, [searchParams]);

  /* ── auto-redirect ──────────────────────────────────────── */
  useEffect(() => {
    if (!user || redirecting) return;
    setRedirecting(true);
    const path = getRedirectCookie() || searchParams.get('redirect');
    setTimeout(() => {
      if (path) { clearRedirectCookie(); router.push(path); }
      else router.push('/');
    }, 100);
  }, [user, redirecting, router, searchParams]);

  /* ── reCAPTCHA: get token + verify ─────────────────────── */
  async function runRecaptcha(action: string, extra?: { email?: string; phone?: string }) {
    const token = await getRecaptchaToken(action);
    if (!token) return { ok: true as const, assessmentName: undefined };
    const result = await verifyRecaptchaToken(token, action, {
      accountId: extra?.email,   // use email as stable account ID
      ...extra,
    });
    if (!result.ok) setError(result.error ?? 'Security check failed. Please try again.');
    return result;
  }

  /* ── Google sign-in ─────────────────────────────────────── */
  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError('');
    const r = searchParams.get('redirect');
    if (r && !getRedirectCookie()) setRedirectCookie(r);

    const { ok } = await runRecaptcha('LOGIN');
    if (!ok) { setLoading(false); return; }

    const { error: authErr } = await signInWithGoogle();
    if (authErr) { setError(authErr.message || 'Failed to sign in with Google'); setLoading(false); }
    // OAuth redirect handled externally — no annotation needed here
  };

  /* ── Email sign-in ──────────────────────────────────────── */
  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // 1. reCAPTCHA assessment (includes Account Defender userInfo)
    const { ok, assessmentName } = await runRecaptcha('LOGIN', { email });
    if (!ok) { setLoading(false); return; }

    // 2. Supabase auth
    const { error: authErr } = await signIn(email, password);

    // 3. Annotate the assessment now that we know the outcome
    if (assessmentName) {
      if (!authErr) {
        // successful login
        annotateAssessment(assessmentName, 'LEGITIMATE', ['CORRECT_PASSWORD'], email);
      } else {
        // failed login — distinguish wrong password vs other errors
        const isWrongCreds =
          authErr.message?.toLowerCase().includes('invalid') ||
          authErr.message?.toLowerCase().includes('password') ||
          authErr.message?.toLowerCase().includes('credentials');

        annotateAssessment(
          assessmentName,
          'FRAUDULENT',
          isWrongCreds ? ['INCORRECT_PASSWORD'] : [],
          email,
        );
      }
    }

    if (authErr) { setError(authErr.message || 'Failed to sign in'); }
    setLoading(false);
  };

  /* ── redirecting spinner ────────────────────────────────── */
  if (redirecting) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <div className="w-full max-w-md bg-[#23272f] rounded-2xl shadow-xl px-6 py-6 flex flex-col items-center border border-gray-800">
          <img src="/logo.png" alt="Kilax" width={48} height={48}
            className="w-12 h-12 object-contain rounded mb-4" />
          <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-white mt-4 text-sm">Redirecting…</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <RecaptchaGuard />

      <div className="flex min-h-screen items-center justify-center bg-black">
        <div className="w-full max-w-md bg-[#23272f] rounded-2xl shadow-xl px-6 py-6 flex flex-col items-center border border-gray-800">

          {/* Logo */}
          <div className="flex flex-col items-center mb-6">
            <img src="/logo.png" alt="Kilax Movies Logo" width={48} height={48}
              className="w-12 h-12 object-contain rounded mb-1" />
            <p className="text-gray-400 text-sm">Watch your favorites</p>
          </div>

          <div className="w-full flex flex-col gap-3">
            <h2 className="text-lg font-semibold text-white text-center mb-2">Sign In</h2>

            {error && (
              <div className="w-full p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                <p className="text-red-400 text-sm text-center">{error}</p>
              </div>
            )}
            {message && (
              <div className="w-full p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                <p className="text-green-400 text-sm text-center">{message}</p>
              </div>
            )}

            {/* Google */}
            <button
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="flex items-center justify-center gap-2 w-full py-3 rounded-lg bg-white text-black text-base font-medium hover:bg-orange-100 transition border border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-5 h-5" viewBox="0 0 48 48">
                <g>
                  <path fill="#4285F4" d="M24 9.5c3.54 0 6.7 1.22 9.19 3.23l6.85-6.85C35.46 2.14 30.12 0 24 0 14.88 0 6.74 5.06 2.69 12.44l7.97 6.19C12.13 13.43 17.62 9.5 24 9.5z"/>
                  <path fill="#34A853" d="M46.1 24.55c0-1.64-.15-3.22-.44-4.74H24v9.04h12.44c-.54 2.92-2.17 5.39-4.63 7.07l7.19 5.6C43.97 37.14 46.1 31.33 46.1 24.55z"/>
                  <path fill="#FBBC05" d="M10.66 28.63A14.48 14.48 0 0 1 9.5 24c0-1.62.28-3.19.77-4.63l-7.97-6.19A23.91 23.91 0 0 0 0 24c0 3.85.92 7.48 2.54 10.69l8.12-6.06z"/>
                  <path fill="#EA4335" d="M24 48c6.12 0 11.26-2.03 15.01-5.53l-7.19-5.6c-2.01 1.35-4.59 2.16-7.82 2.16-6.38 0-11.87-3.93-13.34-9.44l-8.12 6.06C6.74 42.94 14.88 48 24 48z"/>
                </g>
              </svg>
              {loading ? 'Verifying…' : 'Continue with Google'}
            </button>

            <div className="flex items-center gap-2">
              <div className="flex-1 h-px bg-gray-700" />
              <span className="text-xs text-gray-500">OR CONTINUE WITH EMAIL</span>
              <div className="flex-1 h-px bg-gray-700" />
            </div>

            {/* Email form */}
            <form onSubmit={handleEmailSignIn} className="w-full flex flex-col gap-3">
              <input
                type="email" placeholder="Email"
                value={email} onChange={e => setEmail(e.target.value)}
                required disabled={loading}
                className="w-full rounded bg-[#22283a] border border-gray-700 px-4 py-3 text-base text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-50"
              />
              <PasswordInput
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Password"
                disabled={loading}
                required
                autoComplete="current-password"
              />
              <Button
                type="submit" size="lg" disabled={loading}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold text-base py-3 rounded-lg mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Verifying…' : 'Sign In'}
              </Button>
            </form>
          </div>

          {/* Links */}
          <div className="w-full flex flex-col items-center mt-5">
            <Link href="/forgot-password" className="text-sm text-orange-400 hover:underline mb-2">
              Forgot your password?
            </Link>
            <span className="text-gray-400 text-sm">
              Don&apos;t have an account?{' '}
              <Link href="/signup" className="text-orange-400 hover:underline">Sign up</Link>
            </span>
          </div>

          {/* Google required disclosure */}
          <p className="text-[10px] text-gray-600 text-center mt-4 leading-relaxed">
            Protected by reCAPTCHA Enterprise.{' '}
            <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="underline">Privacy</a>
            {' & '}
            <a href="https://policies.google.com/terms" target="_blank" rel="noopener noreferrer" className="underline">Terms</a>
          </p>
        </div>
      </div>
    </>
  );
}
