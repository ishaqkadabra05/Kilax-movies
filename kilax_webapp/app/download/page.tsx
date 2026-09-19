"use client";

import React, { useState } from "react";
import Image from "next/image";
import {
  Smartphone,
  Monitor,
  Apple,
  Download,
  CheckCircle2,
  Wifi,
  ShieldCheck,
  Zap,
  Star,
  MessageCircle,
  Send,
  ChevronRight,
  PlayCircle,
} from "lucide-react";
import { usePWAInstall } from "@/components/PWAInstallPrompt";

/* ── feature pills ──────────────────────────────────────────── */
const features = [
  { icon: Wifi,        label: "Offline Viewing" },
  { icon: ShieldCheck, label: "Secure & Private" },
  { icon: Zap,         label: "Fast Streaming" },
  { icon: Star,        label: "HD Quality" },
];

/* ── platforms ──────────────────────────────────────────────── */
const platforms = [
  {
    id: "android",
    icon: Smartphone,
    name: "Android",
    sub: "Android 6.0+",
    href: "#",
    cta: "Tap to install",
    available: true,
    gradient: "from-green-500 to-emerald-600",
    glow: "shadow-green-500/25",
  },
  {
    id: "windows",
    icon: Monitor,
    name: "Windows",
    sub: "Windows 10 / 11",
    href: "#",
    cta: "Tap to install",
    available: true,
    gradient: "from-blue-500 to-indigo-600",
    glow: "shadow-blue-500/25",
    download: true,
  },
  {
    id: "ios",
    icon: Apple,
    name: "iOS",
    sub: "iPhone & iPad",
    href: "#",
    cta: "Tap to install",
    available: true,
    gradient: "from-gray-500 to-gray-600",
    glow: "",
  },
] as const;

/* ── reviews ────────────────────────────────────────────────── */
const reviews = [
  { name: "Brian K.",   stars: 5, text: "Best app for Ugandan movies. Works perfectly offline." },
  { name: "Sarah M.",  stars: 5, text: "Smooth, fast and the picture quality is amazing!" },
  { name: "David O.",  stars: 4, text: "Love the series collection. Highly recommend." },
];

export default function DownloadPage() {
  const [copied, setCopied] = useState(false);
  const [showInstallHelp, setShowInstallHelp] = useState(false);
  const { canInstall, installed, install } = usePWAInstall();

  async function handleInstall() {
    if (installed) return
    if (canInstall && await install()) return
    setShowInstallHelp(true)
  }

  const handleAndroidDownload = () => {
    /* Replace "#" with real APK URL when available */
    window.open("#", "_blank");
  };

  return (
    <main className="min-h-screen bg-[#05070e] text-white overflow-x-hidden">

      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="relative pt-20 pb-16 px-4 text-center overflow-hidden">
        {/* Background glow blobs */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-orange-500/10 blur-[120px]" />
          <div className="absolute top-40 -left-20 w-72 h-72 rounded-full bg-blue-600/8 blur-[80px]" />
          <div className="absolute top-40 -right-20 w-72 h-72 rounded-full bg-emerald-600/8 blur-[80px]" />
        </div>

        <div className="relative z-10 max-w-2xl mx-auto">
          {/* App icon */}
          <div className="mx-auto mb-6 w-24 h-24 rounded-[28px] bg-gradient-to-br from-orange-500 to-orange-700 shadow-2xl shadow-orange-500/40 flex items-center justify-center ring-4 ring-orange-500/20">
            <Image src="/logo.png" alt="Kilax" width={56} height={56}
              className="w-14 h-14 object-contain rounded-xl" />
          </div>

          {/* Badge */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-500/12 border border-orange-500/25 text-orange-400 text-xs font-semibold mb-4">
            <PlayCircle className="w-3.5 h-3.5" />
            Stream · Download · Enjoy
          </div>

          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight mb-4 leading-tight">
            Get the{" "}
            <span className="bg-gradient-to-r from-orange-400 to-orange-600 bg-clip-text text-transparent">
              Kilax App
            </span>
          </h1>
          <p className="text-gray-400 text-base sm:text-lg leading-relaxed max-w-lg mx-auto mb-8">
            The best Ugandan movies &amp; series — on your Android, Windows PC, or in your browser.
            Fast, secure, and available offline.
          </p>

          {/* Feature pills */}
          <div className="flex flex-wrap items-center justify-center gap-2 mb-2">
            {features.map(({ icon: Icon, label }) => (
              <span key={label}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-gray-300 text-xs font-medium">
                <Icon className="w-3.5 h-3.5 text-orange-400" />
                {label}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Download cards ───────────────────────────────────── */}
      <section className="px-4 pb-16 max-w-2xl mx-auto">
        <div className="flex flex-col gap-4">
            {platforms.map((p) => (
            <PlatformCard key={p.id} platform={p} onInstall={handleInstall} />
          ))}
        </div>
      </section>

      {showInstallHelp && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4" role="dialog" aria-modal="true" aria-labelledby="install-help-title">
        <div className="w-full max-w-md rounded-2xl border border-orange-500/30 bg-[#111522] p-6 shadow-2xl">
          <h2 id="install-help-title" className="text-xl font-bold text-white">Install Kilax</h2>
          <p className="mt-2 text-sm leading-relaxed text-gray-300">Your browser did not offer the automatic install prompt. Open the browser menu and choose <strong>Install Kilax</strong> or <strong>Add to Home Screen</strong>.</p>
          <button onClick={() => setShowInstallHelp(false)} className="mt-5 w-full rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white hover:bg-orange-600">Close</button>
        </div>
      </div>}

      {/* ── How to install (Android) ─────────────────────────── */}
      <section className="px-4 pb-16 max-w-2xl mx-auto">
        <div className="rounded-2xl bg-white/4 border border-white/8 p-6">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Download className="w-5 h-5 text-orange-400" />
            How to install on Android
          </h2>
          <ol className="space-y-3">
            {[
              'Tap "Download APK" above and save the file.',
              "Open your Files app and find the downloaded APK.",
              'Tap the file \u2014 if prompted, allow "Install from unknown sources".',
              "Tap Install and wait a few seconds.",
              "Open Kilax and enjoy!",
            ].map((step, i) => (
              <li key={i} className="flex items-start gap-3 text-sm text-gray-300">
                <span className="mt-0.5 w-6 h-6 rounded-full bg-orange-500/15 border border-orange-500/30 text-orange-400 text-xs font-bold flex items-center justify-center flex-shrink-0">
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── Reviews ──────────────────────────────────────────── */}
      <section className="px-4 pb-16 max-w-2xl mx-auto">
        <h2 className="text-lg font-bold text-white mb-4 text-center">What users say</h2>
        <div className="grid sm:grid-cols-3 gap-3">
          {reviews.map((r) => (
            <div key={r.name} className="rounded-2xl bg-white/4 border border-white/8 p-4">
              <div className="flex gap-0.5 mb-2">
                {Array.from({ length: r.stars }).map((_, i) => (
                  <Star key={i} className="w-3.5 h-3.5 fill-orange-400 text-orange-400" />
                ))}
              </div>
              <p className="text-sm text-gray-300 leading-relaxed mb-3">&ldquo;{r.text}&rdquo;</p>
              <p className="text-xs text-gray-500 font-semibold">{r.name}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Support ──────────────────────────────────────────── */}
      <section className="px-4 pb-20 max-w-2xl mx-auto">
        <div className="rounded-2xl bg-gradient-to-br from-orange-500/8 to-orange-600/4 border border-orange-500/15 p-6 text-center">
          <p className="text-gray-400 text-sm mb-4">Need help installing or have a question?</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <SupportLink
              href="https://wa.me/256780846800"
              color="green"
              label="WhatsApp Support"
              icon={
                <svg viewBox="0 0 448 512" className="w-4 h-4" fill="currentColor">
                  <path d="M380.9 97.1C339 55.1 283.2 32 223.9 32c-122.4 0-222 99.6-222 222 0 39.1 10.2 77.3 29.6 111L0 480l117.7-30.9c32.4 17.7 68.9 27 106.1 27h.1c122.3 0 224.1-99.6 224.1-222 0-59.3-25.2-115-67.1-157zm-157 341.6c-33.2 0-65.7-8.9-94-25.7l-6.7-4-69.8 18.3L72 359.2l-4.4-7c-18.5-29.4-28.2-63.3-28.2-98.2 0-101.7 82.8-184.5 184.6-184.5 49.3 0 95.6 19.2 130.4 54.1 34.8 34.9 56.2 81.2 56.1 130.5 0 101.8-84.9 184.6-186.6 184.6zm101.2-138.2c-5.5-2.8-32.8-16.2-37.9-18-5.1-1.9-8.8-2.8-12.5 2.8-3.7 5.6-14.3 18-17.6 21.8-3.2 3.7-6.5 4.2-12 1.4-32.6-16.3-54-29.1-75.5-66-5.7-9.8 5.7-9.1 16.3-30.3 1.8-3.7.9-6.9-.5-9.7-1.4-2.8-12.5-30.1-17.1-41.2-4.5-10.8-9.1-9.3-12.5-9.5-3.2-.2-6.9-.2-10.6-.2-3.7 0-9.7 1.4-14.8 6.9-5.1 5.6-19.4 19-19.4 46.3 0 27.3 19.9 53.7 22.6 57.4 2.8 3.7 39.1 59.7 94.8 83.8 35.2 15.2 49 16.5 66.6 13.9 10.7-1.6 32.8-13.4 37.4-26.4 4.6-13 4.6-24.1 3.2-26.4-1.3-2.5-5-3.9-10.5-6.6z" />
                </svg>
              }
            />
            <SupportLink
              href="https://t.me/256780846800"
              color="blue"
              label="Telegram Support"
              icon={
                <svg viewBox="0 0 50 50" className="w-4 h-4" fill="currentColor">
                  <path d="M25,2c12.703,0,23,10.297,23,23S37.703,48,25,48S2,37.703,2,25S12.297,2,25,2z M32.934,34.375c0.423-1.298,2.405-14.234,2.65-16.783c0.074-0.772-0.17-1.285-0.648-1.514c-0.578-0.278-1.434-0.139-2.427,0.219c-1.362,0.491-18.774,7.884-19.78,8.312c-0.954,0.405-1.856,0.847-1.856,1.487c0,0.45,0.267,0.703,1.003,0.966c0.766,0.273,2.695,0.858,3.834,1.172c1.097,0.303,2.346,0.04,3.046-0.395c0.742-0.461,9.305-6.191,9.92-6.693c0.614-0.502,1.104,0.141,0.602,0.644c-0.502,0.502-6.38,6.207-7.155,6.997c-0.941,0.959-0.273,1.953,0.358,2.351c0.721,0.454,5.906,3.932,6.687,4.49c0.781,0.558,1.573,0.811,2.298,0.811C32.191,36.439,32.573,35.484,32.934,34.375z" />
                </svg>
              }
            />
          </div>
        </div>
      </section>
    </main>
  );
}

/* ── Platform card ──────────────────────────────────────────── */
function PlatformCard({ platform, onInstall }: { platform: typeof platforms[number]; onInstall: () => void }) {
  const { icon: Icon, name, sub, href, cta, available, gradient, glow, } = platform;
  const inner = (
    <div className={`group flex items-center gap-4 p-5 rounded-2xl border transition-all duration-200 ${
      available
        ? `bg-white/4 border-white/8 hover:border-white/18 hover:bg-white/7 cursor-pointer`
        : "bg-white/2 border-white/5 opacity-60 cursor-default"
    }`}>
      {/* Icon bubble */}
      <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center flex-shrink-0 shadow-lg ${glow}`}>
        <Icon className="w-7 h-7 text-white" />
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className="font-bold text-white text-base">{name}</p>
        <p className="text-xs text-gray-500 mt-0.5">{sub}</p>
      </div>

      {/* CTA */}
      {available ? (
        <div className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r ${gradient} text-white text-sm font-semibold shadow-lg ${glow} group-hover:scale-105 transition-transform duration-150 flex-shrink-0`}>
          <Download className="w-4 h-4" />
          {cta}
          <ChevronRight className="w-3.5 h-3.5 opacity-70" />
        </div>
      ) : (
        <span className="px-3 py-1.5 rounded-xl bg-white/6 border border-white/10 text-gray-500 text-xs font-semibold flex-shrink-0">
          Coming Soon
        </span>
      )}
    </div>
  );

  if (!available || !href) return inner;
  return <button type="button" onClick={onInstall} className="block w-full text-left">{inner}</button>;
}

/* ── Support link ───────────────────────────────────────────── */
function SupportLink({
  href, label, icon, color,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  color: "green" | "blue";
}) {
  const cls =
    color === "green"
      ? "bg-green-500/10 border-green-500/25 text-green-400 hover:bg-green-500/20"
      : "bg-blue-500/10 border-blue-500/25 text-blue-400 hover:bg-blue-500/20";
  return (
    <a href={href} target="_blank" rel="noopener noreferrer"
      className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border text-sm font-semibold transition-colors duration-150 ${cls}`}>
      {icon}
      {label}
    </a>
  );
}
