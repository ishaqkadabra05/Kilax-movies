import { NextRequest, NextResponse } from 'next/server';

/**
 * reCAPTCHA Enterprise — Annotate Assessment
 *
 * Docs: https://cloud.google.com/recaptcha-enterprise/docs/annotate-assessment
 *
 * Call this AFTER you know the outcome of a login/signup attempt so Account
 * Defender can tune its site-specific model.
 *
 * Request body:
 *   assessmentName  string   — "name" field returned by the create-assessment route
 *   annotation      string   — "LEGITIMATE" | "FRAUDULENT"
 *   reasons         string[] — e.g. ["CORRECT_PASSWORD"] | ["INCORRECT_PASSWORD"]
 *   accountId       string?  — stable identifier if not provided at assessment time
 */
export async function POST(req: NextRequest) {
  // bypass in dev or when not configured
  if (process.env.RECAPTCHA_DEV_BYPASS === 'true') {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const apiKey = process.env.RECAPTCHA_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json({ ok: true, skipped: true, reason: 'not_configured' });
  }

  let assessmentName: string;
  let annotation: string | undefined;
  let reasons: string[] | undefined;
  let accountId: string | undefined;

  try {
    const body     = await req.json();
    assessmentName = body.assessmentName;
    annotation     = body.annotation;
    reasons        = body.reasons;
    accountId      = body.accountId;
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid request body' }, { status: 400 });
  }

  if (!assessmentName) {
    return NextResponse.json({ ok: false, error: 'Missing assessmentName' }, { status: 400 });
  }

  try {
    // assessmentName is already the full resource path:
    // "projects/{project}/assessments/{id}"
    const url = `https://recaptchaenterprise.googleapis.com/v1/${assessmentName}:annotate?key=${apiKey}`;

    const body: Record<string, unknown> = {};
    if (annotation) body.annotation = annotation;
    if (reasons?.length) body.reasons = reasons;
    if (accountId) body.accountId = accountId;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('[reCAPTCHA] Annotate error:', res.status, errText);
      // Annotation failure should never block the user — log and move on
      return NextResponse.json({ ok: true, annotated: false, error: errText });
    }

    return NextResponse.json({ ok: true, annotated: true });

  } catch (err) {
    console.error('[reCAPTCHA] Annotate unexpected error:', err);
    return NextResponse.json({ ok: true, annotated: false }); // never block user
  }
}
