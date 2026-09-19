"use client";

import { useAuth } from '@/components/AuthProvider';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getProfile, Profile } from '@/lib/profiles';
import { supabase } from '@/lib/supabase';
import { Share2, Users, Gift, Sparkles, Link2, X } from 'lucide-react';

interface ReferralStats {
  coins: number;
  kilaxId: string | null;
  links: Array<{ ref_code: string; content_title: string | null; total_clicks: number; total_signups: number; total_coins: number }>;
  ledger: Array<{ amount: number; reason: string; created_at: string }>;
}

function StandaloneShareEarnModal({ link, busy, onClose, onShare, onCopy }: { link:string; busy:boolean; onClose:()=>void; onShare:()=>void; onCopy:()=>void }) {
  const benefits = [[Users, '+5 watches per friend', 'Every friend who opens your link', 'text-amber-400 bg-amber-500/15'], [Gift, 'Credits never expire', 'Stack them up and use anytime', 'text-blue-400 bg-blue-500/15'], [Sparkles, 'Unlimited earning', 'No cap - share as much as you want', 'text-purple-400 bg-purple-500/15']] as const;
  return <div onClick={onClose} className="fixed inset-0 z-[230] grid place-items-center bg-black/80 p-4 backdrop-blur-md"><div onClick={e=>e.stopPropagation()} className="fade-up w-full max-w-xl max-h-[92vh] overflow-y-auto rounded-2xl border border-white/15 bg-[#171922] shadow-2xl"><div className="flex items-center gap-3 border-b border-white/10 p-5"><div className="flex h-13 w-13 items-center justify-center rounded-2xl border border-orange-500/40 bg-orange-500/15"><Share2 className="h-6 w-6 text-amber-400" /></div><div className="min-w-0 flex-1"><h2 className="text-lg font-extrabold text-white">Share &amp; Earn Free Watches</h2><p className="text-sm text-gray-400">Every friend you bring earns you more</p></div><button onClick={onClose} aria-label="Close" className="flex h-10 w-10 items-center justify-center rounded-full border-0 bg-white/10 text-2xl text-gray-400">×</button></div><div className="p-5"><p className="mb-3 text-xs font-extrabold tracking-wider text-gray-400">WHAT YOU GET</p><div className="mb-5 grid grid-cols-3 gap-2">{benefits.map(([Icon,title,text,color])=><div key={title} className="rounded-xl border border-white/10 bg-white/5 p-3 text-center"><div className={`mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full ${color}`}><Icon className="h-5 w-5" /></div><p className="whitespace-pre-line text-xs font-extrabold leading-tight text-white">{title}</p><p className="mt-2 text-[11px] leading-tight text-gray-500">{text}</p></div>)}</div><div className="mb-5 grid gap-3 text-sm text-gray-400">{['Copy your link below and share it on WhatsApp, TikTok, or anywhere.','For even more rewards, share a specific movie or series page - each one counts separately.','Every friend who opens your link earns you +5 free watches.'].map((text,index)=><div key={text} className="flex gap-2"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-orange-500/20 text-xs font-bold text-amber-400">{index+1}</span><span>{text}</span></div>)}</div><div className="mb-2 flex gap-2"><input readOnly value={link || 'Preparing your referral link...'} aria-label="Referral link" className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-xs text-gray-400" /><button onClick={onCopy} aria-label="Copy referral link" className="flex h-11 w-12 items-center justify-center rounded-xl border border-white/10 bg-white/10 text-gray-300"><Link2 className="h-4 w-4" /></button></div><button onClick={onShare} disabled={busy} className="mb-2 flex w-full items-center justify-center rounded-xl border-0 bg-orange-500 py-3 font-extrabold text-gray-950">{busy ? 'Sharing...' : '↗ Share My Link'}</button><div className="grid grid-cols-2 gap-2"><button onClick={onClose} className="rounded-xl border border-white/10 bg-white/5 py-3 text-xs font-bold text-gray-400">Share a Movie →</button><button onClick={onClose} className="rounded-xl border border-white/10 bg-white/5 py-3 text-xs font-bold text-gray-400">Share a Series →</button></div></div></div></div>;
}

export default function ProfilePage() {
  const { user } = useAuth();
  const [profile,   setProfile]   = useState<Profile | null>(null);
  const [genresMap, setGenresMap] = useState<Record<string, string>>({});
  const [loading,   setLoading]   = useState(true);
  const [stats,     setStats]     = useState<ReferralStats | null>(null);
  const [allowance, setAllowance] = useState<any>(null);
  const [clock, setClock] = useState(Date.now());
  const [payments, setPayments] = useState<any[]>([]);
  const [activeSubscription, setActiveSubscription] = useState(false);
  const [referralBusy, setReferralBusy] = useState(false);
  const [referralModal, setReferralModal] = useState(false);
  const [referralLink, setReferralLink] = useState('');

  useEffect(() => {
    const fetchProfileData = async () => {
      if (user) {
        const prof = await getProfile(user.id);
        if (prof && !prof.email && user.email) prof.email = user.email;
        setProfile(prof);

        if (prof?.favorite_genres && prof.favorite_genres.length > 0) {
          const { data, error } = await supabase
            .from('genres')
            .select('id, name')
            .in('id', prof.favorite_genres);
          if (!error && data) {
            const gMap: Record<string, string> = {};
            (data as Array<{ id: string; name: string }>).forEach(g => { gMap[g.id] = g.name; });
            setGenresMap(gMap);
          }
        }

        // Fetch coins + referral stats
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.access_token) {
            const res = await fetch('/api/referral/balance', {
              headers: { Authorization: `Bearer ${session.access_token}` },
              cache: 'no-store',
            });
            if (res.ok) setStats(await res.json());
            const allowanceRes = await fetch('/api/free-allowance', {
              headers: { Authorization: `Bearer ${session.access_token}` },
              cache: 'no-store',
            });
            if (allowanceRes.ok) setAllowance(await allowanceRes.json());
            const { data: paymentRows } = await supabase
              .from('subscriptions')
              .select('id, plan_id, subscription_type, start_date, expiry_date, payment_method')
              .eq('user_id', user.id)
              .order('start_date', { ascending: false })
              .limit(6);
            setPayments(paymentRows || []);
          }
        } catch { /* non-critical */ }
      }
      setLoading(false);
    };
    fetchProfileData();
  }, [user]);

  useEffect(() => {
    const expiry = profile?.subscription_expiry_date ? new Date(profile.subscription_expiry_date) : null;
    setActiveSubscription(Boolean(profile?.subscription && profile.subscription.toLowerCase() !== 'free' && expiry && expiry > new Date()));
  }, [profile]);

  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const resetCountdown = allowance?.resetAt
    ? (() => {
        const remaining = Math.max(0, new Date(allowance.resetAt).getTime() - clock);
        const hours = Math.floor(remaining / 3600000);
        const minutes = Math.floor((remaining % 3600000) / 60000);
        return `${hours}h ${String(minutes).padStart(2, '0')}m`;
      })()
    : '00:00hrs';

  const loadReferralLink = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) return '';
    const url = `https://kilaxmovies.com/?ref=${encodeURIComponent(session.user.id)}`;
    setReferralLink(url);
    return url;
  };

  const openReferralModal = async () => {
    setReferralModal(true);
    if (!referralLink) await loadReferralLink();
  };

  const shareReferralLink = async () => {
    if (referralBusy) return;
    setReferralBusy(true);
    try {
      const url = referralLink || await loadReferralLink();
      if (!url) return;
      if (navigator.share) await navigator.share({ title: 'Kilax Movies', text: 'Join me on Kilax Movies and get free watches.', url });
      else { await navigator.clipboard.writeText(url); }
    } catch { /* User cancelled sharing or clipboard was unavailable. */ }
    finally { setReferralBusy(false); }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white">
        <div className="p-8 bg-gray-900 rounded-xl shadow-xl text-center">
          <h2 className="text-2xl font-bold mb-4">Please Sign In</h2>
          <Link href="/signin" className="px-4 py-2 bg-orange-500 rounded-lg text-white font-semibold hover:bg-orange-600 transition">Sign In</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="container mx-auto px-4 py-12 max-w-5xl">
        <h1 className="text-3xl font-bold text-orange-400 mb-10 text-center">Your Profile</h1>

        {loading ? (
          <div className="flex justify-center items-center">
            <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : !profile ? (
          <div className="p-4 bg-yellow-900/40 border border-yellow-700 rounded-lg text-yellow-300 text-center">
            No profile found.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

            {/* ── Left: User Details ── */}
            <div className="flex flex-col items-center w-full bg-black/40 rounded-2xl p-10 border border-gray-800">
              <div className="w-28 h-28 rounded-full bg-orange-500 flex items-center justify-center text-3xl font-bold text-white overflow-hidden mb-4">
                {profile.avatar_url ? (
                  <img src={profile.avatar_url} alt="avatar" className="w-full h-full object-cover rounded-full" />
                ) : (
                  (profile.full_name || profile.name)?.[0]?.toUpperCase() || profile.email?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'
                )}
              </div>
              <div className="text-xl font-semibold mb-1">{profile.full_name || profile.name || profile.email || user?.email}</div>
              <div className="text-sm text-gray-400 mb-1">Email: {profile.email || user?.email || '—'}</div>
              <div className="text-sm text-gray-400 mb-1">Joined: {profile.created_at ? new Date(profile.created_at).toLocaleDateString() : ''}</div>

              {/* Kilax Device/User ID */}
              {stats?.kilaxId && (
                <div className="mt-3 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-gray-400 font-mono w-full text-center">
                  🆔 {stats.kilaxId}
                </div>
              )}

              {profile.favorite_genres && profile.favorite_genres.length > 0 && (
                <div className="text-sm text-gray-400 mt-2 text-center">Favorite Genres: {profile.favorite_genres.map(g => genresMap[g] || g).join(', ')}</div>
              )}
              {profile.favorite_vjs && profile.favorite_vjs.length > 0 && (
                <div className="text-sm text-gray-400 mt-1 text-center">Favorite VJs: {profile.favorite_vjs.join(', ')}</div>
              )}
              {profile.favorite_actors && profile.favorite_actors.length > 0 && (
                <div className="text-sm text-gray-400 mt-1 text-center">Favorite Actors: {profile.favorite_actors.join(', ')}</div>
              )}
            </div>

            {/* ── Right: Subscription + Coins ── */}
            <div className="flex flex-col gap-4">

              {/* Subscription card */}
              <div className="flex flex-col items-center bg-black/40 rounded-2xl p-6 border border-gray-800">
                <div className="text-xl font-semibold mb-3">Current Package / Subscription Plan</div>
                {activeSubscription ? (
                  <div className="text-green-400 text-lg font-bold mb-2">{profile.subscription}</div>
                ) : (
                  <div className="text-yellow-300 mb-2">Free User</div>
                )}
                {activeSubscription && profile.subscription_start_date && (
                  <div className="text-sm text-gray-400 mb-1">Start: {new Date(profile.subscription_start_date).toLocaleDateString()}</div>
                )}
                {activeSubscription && profile.subscription_expiry_date && (
                  <div className="text-sm text-gray-400 mb-1">Expires: {new Date(profile.subscription_expiry_date).toLocaleDateString()}</div>
                )}
              </div>

              <button onClick={openReferralModal} className="flex w-full items-center gap-4 rounded-2xl border border-orange-500/50 bg-[#171922] px-4 py-3 text-left text-white">
                <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-orange-500/60 bg-orange-500/10"><Share2 className="h-7 w-7 text-amber-400" /></span>
                <span><span className="block text-xl font-extrabold leading-tight">Share &amp; Earn Free Watches</span><span className="mt-1 block text-sm text-blue-200/70">Every friend you bring earns you more free coins</span></span>
              </button>
              {referralModal && <StandaloneShareEarnModal link={referralLink} busy={referralBusy} onClose={() => setReferralModal(false)} onShare={shareReferralLink} onCopy={async () => { const url = referralLink || await loadReferralLink(); if (url) await navigator.clipboard.writeText(url); }} />}

              {/* Daily free allowance */}
              <div className="bg-black/40 rounded-2xl border border-gray-800 overflow-hidden">
                <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-white/10">
                  <div className="text-base font-extrabold uppercase leading-tight text-blue-400">Today&apos;s Free<br/>Allowance</div>
                  <div className="text-xs text-gray-400 whitespace-nowrap">◷ resets in {resetCountdown}</div>
                </div>
                {activeSubscription ? (
                  <p className="text-sm text-gray-400 p-5">Your current package has unlimited viewing access.</p>
                ) : (
                  <div className="p-5">
                    <div className="flex items-center justify-between mb-3"><span className="text-sm text-gray-300">Daily credits</span><strong className="text-sm text-white">{Math.max(0, 5 - (allowance?.unitsUsed ?? 0))} / 5 remaining</strong></div>
                    <div className="h-2.5 rounded-full bg-white/10 overflow-hidden mb-4"><div className="h-full rounded-full bg-blue-500" style={{ width: `${Math.max(0, Math.min(100, ((5 - (allowance?.unitsUsed ?? 0)) / 5) * 100))}%` }} /></div>
                    <p className="text-xs text-gray-400 leading-relaxed">Each watch or download costs 5 credits. Resets daily at midnight.</p>
                  </div>
                )}
              </div>

              <div className="bg-black/40 rounded-2xl p-6 border border-gray-800">
                <div className="text-xl font-semibold mb-3">Payment History</div>
                {payments.length ? payments.map((payment, index) => (
                  <div key={payment.id || index} className="flex items-center justify-between gap-3 py-2 border-b border-white/5 last:border-0 text-sm">
                    <span className="text-gray-400">{payment.start_date ? new Date(payment.start_date).toLocaleDateString() : '—'}</span>
                    <span className="text-gray-300">{payment.subscription_type || payment.plan_id || 'Subscription'}</span>
                    <span className="text-green-400">{payment.status || 'Paid'}</span>
                  </div>
                )) : <p className="text-sm text-gray-500">No subscription payments yet.</p>}
              </div>

              {/* Coins & Referral card */}
              <div className="bg-gradient-to-br from-emerald-900/40 to-teal-900/30 rounded-2xl p-6 border border-emerald-500/20">
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-3xl">🪙</span>
                  <div>
                    <div className="text-2xl font-bold text-emerald-400">{stats?.coins ?? 0} coins</div>
                    <div className="text-xs text-gray-400 mt-0.5">Share movies &amp; earn 50 coins per sign-up</div>
                  </div>
                </div>

                {/* Share link stats */}
                {stats && stats.links.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-white/10">
                    <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Your Share Links</div>
                    <div className="flex flex-col gap-2">
                      {stats.links.slice(0, 5).map(link => (
                        <div key={link.ref_code} className="flex items-center justify-between text-xs bg-white/5 rounded-lg px-3 py-2">
                          <span className="text-gray-300 truncate max-w-[120px]">{link.content_title || 'General'}</span>
                          <div className="flex gap-3 text-gray-400 flex-shrink-0 ml-2">
                            <span title="Clicks">👁 {link.total_clicks}</span>
                            <span title="Sign-ups">✅ {link.total_signups}</span>
                            <span className="text-emerald-400" title="Coins earned">🪙 {link.total_coins}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recent earnings */}
                {stats && stats.ledger.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-white/10">
                    <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Recent Earnings</div>
                    <div className="flex flex-col gap-1.5">
                      {stats.ledger.slice(0, 5).map((entry, i) => (
                        <div key={i} className="flex items-center justify-between text-xs">
                          <span className="text-gray-300 capitalize">{entry.reason.replace(/_/g, ' ')}</span>
                          <span className={entry.amount > 0 ? 'text-emerald-400 font-semibold' : 'text-red-400'}>
                            {entry.amount > 0 ? '+' : ''}{entry.amount} 🪙
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {(!stats || stats.links.length === 0) && (
                  <p className="text-xs text-gray-500 mt-2">
                    Tap the <span className="text-emerald-400 font-semibold">Share 🪙</span> button on any movie or series card to start earning coins.
                  </p>
                )}
              </div>

            </div>
          </div>
        )}

        <div className="flex justify-center mt-8">
          <Link href="/" className="inline-flex items-center space-x-2 text-orange-400 hover:text-orange-300 transition-colors duration-200">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span>Back to Home</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
