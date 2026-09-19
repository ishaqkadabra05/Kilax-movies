'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useState, useEffect, Suspense } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { useRouter, useSearchParams } from 'next/navigation';
import { getRedirectCookie, setRedirectCookie } from '@/lib/utils';
import {
  PhoneNumberField,
  PHONE_COUNTRIES,
  isValidInternationalPhone,
  normalizeInternationalPhone,
} from '@/components/PhoneNumberField';
import { isValidEmail, isValidPassword } from '@/lib/validation';
import RecaptchaGuard, {
  getRecaptchaToken,
  verifyRecaptchaToken,
  annotateAssessment,
} from '@/components/RecaptchaGuard';
import PasswordInput from '@/components/PasswordInput';

/* ══════════════════════════════════════════════════════════════ */
function SignUpContent() {
  const [email,           setEmail]           = useState('');
  const [password,        setPassword]        = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [countryCode,     setCountryCode]     = useState('UG');
  const [phone,           setPhone]           = useState('');
  const [loading,         setLoading]         = useState(false);
  const [error,           setError]           = useState('');

  const router       = useRouter();
  const searchParams = useSearchParams();
  const { signUp, signInWithGoogle } = useAuth();

  useEffect(() => {
    const r = searchParams.get('redirect');
    if (r && !getRedirectCookie()) setRedirectCookie(r);
  }, [searchParams]);

  /* ── reCAPTCHA helper ───────────────────────────────────── */
  async function runRecaptcha(
    action: string,
    extra?: { email?: string; phone?: string },
  ) {
    const token = await getRecaptchaToken(action);
    if (!token) return { ok: true as const, assessmentName: undefined };
    const result = await verifyRecaptchaToken(token, action, {
      accountId: extra?.email,
      ...extra,
    });
    if (!result.ok) setError(result.error ?? 'Security check failed. Please try again.');
    return result;
  }

  /* ── Google sign-up ─────────────────────────────────────── */
  const handleGoogleSignUp = async () => {
    setLoading(true);
    setError('');
    const r = searchParams.get('redirect');
    if (r && !getRedirectCookie()) setRedirectCookie(r);

    const { ok } = await runRecaptcha('REGISTRATION');
    if (!ok) { setLoading(false); return; }

    const { error: authErr } = await signInWithGoogle();
    if (authErr) { setError(authErr.message || 'Failed to sign up with Google'); setLoading(false); }
  };

  /* ── Email sign-up ──────────────────────────────────────── */
  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // 1. Client-side validation
    if (!isValidEmail(email)) {
      setError('Please enter a valid email address, e.g. sample@gmail.com');
      return;
    }
    if (!isValidPassword(password)) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    const country = PHONE_COUNTRIES.find(c => c.code === countryCode);
    if (!country || !isValidInternationalPhone(country.dialCode, phone)) {
      setError('Please enter a valid phone number with the country code');
      return;
    }

    setLoading(true);

    const normalizedPhone = normalizeInternationalPhone(country.dialCode, phone);

    // 2. reCAPTCHA assessment with Account Defender userInfo
    const { ok, assessmentName } = await runRecaptcha('REGISTRATION', {
      email,
      phone: normalizedPhone,
    });
    if (!ok) { setLoading(false); return; }

    // 3. Supabase sign-up
    const { error: authErr } = await signUp(
      email.trim().toLowerCase(),
      password,
      normalizedPhone,
    );

    // 4. Annotate the assessment
    if (assessmentName) {
      if (!authErr) {
        annotateAssessment(assessmentName, 'LEGITIMATE', [], email);
      } else {
        annotateAssessment(assessmentName, 'FRAUDULENT', [], email);
      }
    }

    if (!authErr) {
      router.push('/signin?message=check_email');
    } else {
      setError(authErr.message || 'Failed to sign up');
      setLoading(false);
    }
  };

  return (
    <>
      <RecaptchaGuard />

      <div className="flex min-h-screen items-center justify-center bg-black px-4 py-8">
        <div className="w-full max-w-md bg-[#23272f] rounded-2xl shadow-xl px-6 py-6 border border-gray-800">

          {/* Logo */}
          <div className="flex flex-col items-center mb-6">
            <img src="/logo.png" alt="Kilax Movies Logo" width={48} height={48}
              className="w-12 h-12 object-contain rounded mb-1" />
            <p className="text-gray-400 text-sm">Create your account</p>
          </div>

          <h2 className="text-lg font-semibold text-white text-center mb-4">Sign Up</h2>

          {error && (
            <div className="w-full p-3 rounded-lg bg-red-500/10 border border-red-500/20 mb-3">
              <p className="text-red-400 text-sm text-center">{error}</p>
            </div>
          )}

          {/* Google */}
          <button
            onClick={handleGoogleSignUp}
            disabled={loading}
            className="flex items-center justify-center gap-2 w-full py-3 rounded-lg bg-white text-black font-medium hover:bg-orange-100 transition border border-orange-400 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-orange-500"
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

          <div className="flex items-center gap-2 my-4">
            <div className="flex-1 h-px bg-gray-700" />
            <span className="text-xs text-gray-500">OR CONTINUE WITH EMAIL</span>
            <div className="flex-1 h-px bg-gray-700" />
          </div>

          {/* Email form */}
          <form onSubmit={handleEmailSignUp} className="w-full flex flex-col gap-3">
            <input
              type="email" inputMode="email" autoComplete="email"
              placeholder="samplemail@gmail.com"
              value={email} onChange={e => setEmail(e.target.value)}
              required disabled={loading}
              className="w-full rounded bg-[#22283a] border border-gray-700 px-4 py-3 text-base text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-50"
            />
            <PhoneNumberField
              countryCode={countryCode} phone={phone}
              onCountryChange={setCountryCode} onPhoneChange={setPhone}
              disabled={loading}
            />
            <PasswordInput
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Password (minimum 6 characters)"
              disabled={loading}
              required
              minLength={6}
              autoComplete="new-password"
            />
            <PasswordInput
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="Confirm Password"
              disabled={loading}
              required
              minLength={6}
              autoComplete="new-password"
            />
            <Button
              type="submit" size="lg" disabled={loading}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 rounded-lg mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Verifying…' : 'Sign Up'}
            </Button>
          </form>

          <div className="w-full flex justify-center mt-5">
            <span className="text-gray-400 text-sm">
              Already have an account?{' '}
              <Link href="/signin" className="text-orange-400 hover:underline">Sign in</Link>
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

function SignUpFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-black">
      <div className="animate-spin rounded-full h-8 w-8 border-2 border-orange-500 border-t-transparent" />
    </div>
  );
}

export default function SignUp() {
  return (
    <Suspense fallback={<SignUpFallback />}>
      <SignUpContent />
    </Suspense>
  );
}
