import { NextRequest, NextResponse } from 'next/server';

/**
 * reCAPTCHA Enterprise — Create Assessment with Account Defender
 *
 * Docs:
 *  https://cloud.google.com/recaptcha-enterprise/docs/create-assessment
 *  https://cloud.google.com/recaptcha-enterprise/docs/account-defender
 *
 * Required env vars (all optional — missing = skip):
 *   NEXT_PUBLIC_RECAPTCHA_SITE_KEY  public site key loaded in the browser
 *   RECAPTCHA_API_KEY               GCP API key (server-side only)
 *   RECAPTCHA_PROJECT_ID            GCP project ID
 *   RECAPTCHA_MIN_SCORE             minimum risk score 0–1, default 0.7
 *   RECAPTCHA_DEV_BYPASS            "true" to skip all checks (dev/testing)
 *
 * Request body:
 *   token      string   — from grecaptcha.enterprise.execute()
 *   action     string   — expected action name e.g. "LOGIN"
 *   accountId  string?  — stable user identifier (email / user ID)
 *   email      string?  — login email for Account Defender userIds
 *   phone      string?  — phone for Account Defender userIds
 *
 * Response (ok: true):
 *   { ok, score, action, assessmentName, accountDefender }
 *
 * Response (ok: false):
 *   { ok, error, score? }
 */
export async function POST(req: NextRequest) {
  // ── dev / unconfigured bypass ─────────────────────────────
  if (process.env.RECAPTCHA_DEV_BYPASS === 'true') {
    return NextResponse.json({ ok: true, skipped: true, reason: 'dev_bypass' });
  }

  const apiKey    = process.env.RECAPTCHA_API_KEY?.trim();
  const projectId = process.env.RECAPTCHA_PROJECT_ID?.trim();
  const siteKey   = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY?.trim();

  if (!apiKey || !projectId || !siteKey) {
    return NextResponse.json({ ok: true, skipped: true, reason: 'not_configured' });
  }

  // ── parse request body ────────────────────────────────────
  let token: string;
  let action: string | undefined;
  let accountId: string | undefined;
  let email: string | undefined;
  let phone: string | undefined;

  try {
    const body = await req.json();
    token     = body.token;
    action    = body.action;
    accountId = body.accountId;
    email     = body.email;
    phone     = body.phone;
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid request body' }, { status: 400 });
  }

  if (!token) {
    return NextResponse.json({ ok: false, error: 'Missing token' }, { status: 400 });
  }

  try {
    // ── build userInfo for Account Defender ──────────────────
    const userIds: Record<string, string>[] = [];
    if (email) userIds.push({ email });
    if (phone) userIds.push({ phoneNumber: phone });

    const userInfo: Record<string, unknown> = {};
    if (accountId) userInfo.accountId = accountId;
    if (userIds.length) userInfo.userIds = userIds;

    const assessment: Record<string, unknown> = {
      event: {
        token,
        siteKey,
        ...(action    ? { expectedAction: action }  : {}),
        ...(Object.keys(userInfo).length ? { userInfo } : {}),
      },
    };

    const url = `https://recaptchaenterprise.googleapis.com/v1/projects/${projectId}/assessments?key=${apiKey}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(assessment),
      cache: 'no-store',
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('[reCAPTCHA] Enterprise API error:', res.status, errText);
      return NextResponse.json(
        { ok: false, error: 'reCAPTCHA service error' },
        { status: 502 }
      );
    }

    const result = await res.json();
    const { tokenProperties, riskAnalysis, accountDefenderAssessment, name: assessmentName } = result;

    // ── token validity ────────────────────────────────────────
    if (!tokenProperties?.valid) {
      console.warn('[reCAPTCHA] Invalid token:', tokenProperties?.invalidReason);
      return NextResponse.json(
        { ok: false, error: 'Invalid reCAPTCHA token', reason: tokenProperties?.invalidReason },
        { status: 403 }
      );
    }

    // ── action mismatch ───────────────────────────────────────
    if (action && tokenProperties.action && tokenProperties.action !== action) {
      console.warn('[reCAPTCHA] Action mismatch. Expected:', action, 'Got:', tokenProperties.action);
      return NextResponse.json(
        { ok: false, error: 'reCAPTCHA action mismatch' },
        { status: 403 }
      );
    }

    // ── risk score ────────────────────────────────────────────
    const score: number = riskAnalysis?.score ?? 1;
    const minScore = Number(process.env.RECAPTCHA_MIN_SCORE ?? '0.7');

    if (score < minScore) {
      console.warn('[reCAPTCHA] Score too low:', score, '< minScore:', minScore);
      return NextResponse.json(
        { ok: false, error: 'Security check failed. Please try again.', score },
        { status: 403 }
      );
    }

    // ── Account Defender: ATO risk score ──────────────────────
    const atoVerdict = accountDefenderAssessment?.accountTakeoverVerdict;
    const atoRisk: number | undefined = atoVerdict?.risk;
    const atoThreshold = 0.7; // medium — 1% FPR

    if (typeof atoRisk === 'number' && atoRisk > atoThreshold) {
      console.warn('[reCAPTCHA] ATO risk too high:', atoRisk);
      return NextResponse.json(
        {
          ok: false,
          error: 'Suspicious login activity detected. Please try again or reset your password.',
          score,
          atoRisk,
        },
        { status: 403 }
      );
    }

    // ── Account Defender: label-based check ───────────────────
    const defenderLabels: string[] = accountDefenderAssessment?.labels ?? [];
    const suspicious = defenderLabels.includes('SUSPICIOUS_LOGIN_ACTIVITY') ||
                       defenderLabels.includes('SUSPICIOUS_ACCOUNT_CREATION');

    if (suspicious && typeof atoRisk !== 'number') {
      // No ATO score available — fall back to label
      console.warn('[reCAPTCHA] Suspicious account defender label:', defenderLabels);
      return NextResponse.json(
        {
          ok: false,
          error: 'Suspicious activity detected. Please try again.',
          score,
          defenderLabels,
        },
        { status: 403 }
      );
    }

    return NextResponse.json({
      ok: true,
      score,
      action: tokenProperties.action,
      assessmentName,                   // needed for annotation
      accountDefender: {
        labels: defenderLabels,
        atoRisk,
        atoRiskReasons:  atoVerdict?.riskReasons  ?? [],
        atoTrustReasons: atoVerdict?.trustReasons ?? [],
        profileMatch: defenderLabels.includes('PROFILE_MATCH'),
      },
    });

  } catch (err) {
    console.error('[reCAPTCHA] Unexpected error:', err);
    return NextResponse.json(
      { ok: false, error: 'reCAPTCHA verification failed' },
      { status: 500 }
    );
  }
}
