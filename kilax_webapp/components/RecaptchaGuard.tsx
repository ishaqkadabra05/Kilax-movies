"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    grecaptcha?: {
      enterprise: {
        ready: (cb: () => void) => void;
        execute: (siteKey: string, opts: { action: string }) => Promise<string>;
      };
    };
  }
}

const SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY?.trim() ?? "";

function isAllowedRecaptchaHost(): boolean {
  if (typeof window === "undefined") return false;

  const host = window.location.hostname.toLowerCase();
  const allowed = ["localhost", "127.0.0.1", "kilaxmovies.com", "www.kilaxmovies.com"];

  return allowed.includes(host) || host.endsWith(".kilaxmovies.com");
}

/**
 * Mount once anywhere in the tree to load the Enterprise JS.
 * Already idempotent — a second mount is a no-op.
 */
export default function RecaptchaGuard() {
  useEffect(() => {
    if (!SITE_KEY || !isAllowedRecaptchaHost()) return;
    if (document.querySelector('script[data-kilax-recaptcha]')) return;

    const s = document.createElement("script");
    s.src = `https://www.google.com/recaptcha/enterprise.js?render=${encodeURIComponent(SITE_KEY)}`;
    s.async = true;
    s.defer = true;
    s.dataset.kilaxRecaptcha = "1";
    s.onerror = () => {
      console.warn("[reCAPTCHA] Failed to load Google Enterprise script. Check the site key and allowed domains.");
      s.remove();
    };
    document.head.appendChild(s);
  }, []);

  return null;
}

/**
 * Get a fresh Enterprise token for the given action.
 *
 * Returns null when:
 *  - the site key is not configured
 *  - the script hasn't loaded yet (caller should show a friendly retry)
 *
 * Usage:
 *   const token = await getRecaptchaToken("login");
 *   if (!token) { ... handle gracefully ... }
 */
export async function getRecaptchaToken(action: string): Promise<string | null> {
  if (!SITE_KEY || !isAllowedRecaptchaHost()) return null;
  if (!window.grecaptcha?.enterprise) {
    console.warn("[reCAPTCHA] Enterprise script is not available on this page.");
    return null;
  }

  // Wait up to 5 s for the script to become ready
  const ready = await new Promise<boolean>((resolve) => {
    let attempts = 0;
    const check = () => {
      if (window.grecaptcha?.enterprise) {
        resolve(true);
      } else if (++attempts > 50) {
        resolve(false);       // 50 × 100 ms = 5 s timeout
      } else {
        setTimeout(check, 100);
      }
    };
    check();
  });

  if (!ready) {
    console.warn("[reCAPTCHA] Enterprise script not ready after 5 s");
    return null;
  }

  return new Promise<string | null>((resolve) => {
    window.grecaptcha!.enterprise.ready(async () => {
      try {
        const token = await window.grecaptcha!.enterprise.execute(SITE_KEY, { action });
        resolve(token);
      } catch (err) {
        console.error("[reCAPTCHA] execute error:", err);
        resolve(null);
      }
    });
  });
}

/**
 * Verify a token server-side via our own API route.
 *
 * Returns:
 *   ok            — true when verification passes or is skipped
 *   error         — human-readable message when ok is false
 *   assessmentName — resource name needed to annotate the assessment afterwards
 *   accountDefender — Account Defender labels / ATO verdict (when available)
 */
export async function verifyRecaptchaToken(
  token: string,
  action: string,
  extra?: { accountId?: string; email?: string; phone?: string },
): Promise<{
  ok: boolean;
  error?: string;
  assessmentName?: string;
  accountDefender?: {
    labels: string[];
    atoRisk?: number;
    profileMatch: boolean;
  };
}> {
  try {
    const res = await fetch("/api/security/recaptcha", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, action, ...extra }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      return { ok: false, error: data.error ?? "Security check failed. Please try again." };
    }
    return {
      ok: true,
      assessmentName: data.assessmentName,
      accountDefender: data.accountDefender,
    };
  } catch {
    // Network error — fail open so a connectivity blip doesn't lock users out
    console.warn("[reCAPTCHA] Verify network error — failing open");
    return { ok: true };
  }
}

/**
 * Annotate a completed assessment so Account Defender can improve its model.
 * Fire-and-forget — never throws, never blocks the user.
 *
 * @param assessmentName  the "assessmentName" field from verifyRecaptchaToken response
 * @param annotation      "LEGITIMATE" | "FRAUDULENT"
 * @param reasons         e.g. ["CORRECT_PASSWORD"] | ["INCORRECT_PASSWORD"] | ["PASSED_TWO_FACTOR"]
 * @param accountId       stable user identifier (email / user ID)
 */
export async function annotateAssessment(
  assessmentName: string,
  annotation: 'LEGITIMATE' | 'FRAUDULENT',
  reasons: string[],
  accountId?: string,
): Promise<void> {
  try {
    await fetch('/api/security/recaptcha/annotate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assessmentName, annotation, reasons, accountId }),
    });
  } catch {
    // silent — annotation is best-effort
  }
}
