import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * /api/trap — Honeypot endpoint.
 *
 * This URL is never linked anywhere visible to real users.
 * It is only referenced in a hidden <a> tag (display:none / aria-hidden)
 * that scrapers and headless browsers follow.
 *
 * Every hit is logged to the `security_events` table in Supabase so you
 * can review and block persistent attackers.
 *
 * The response always looks like a valid JSON API so the bot keeps trying
 * (and keeps logging itself) rather than giving up and moving on.
 */

const REDIRECT =
  "https://www.google.com/search?q=suspicious+software+detected+you+have+been+reported";

async function logEvent(req: NextRequest, method: string) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";

  const ua      = req.headers.get("user-agent") ?? "";
  const referer = req.headers.get("referer") ?? "";
  const origin  = req.headers.get("origin") ?? "";
  const host    = req.headers.get("host") ?? "";
  const path    = req.nextUrl.pathname + req.nextUrl.search;

  // Collect any body the bot sent (scanners often POST payloads)
  let body_preview: string | null = null;
  try {
    const text = await req.text();
    if (text) body_preview = text.slice(0, 500);
  } catch {
    // ignore
  }

  console.warn(
    `[honeypot] HIT | method=${method} ip=${ip} ua="${ua}" path=${path}`
  );

  // Write to Supabase — fire-and-forget, never blocks the response
  try {
    await (supabaseAdmin as any).from("security_events").insert({
      event_type:   "honeypot_hit",
      method,
      path,
      ip_address:   ip,
      user_agent:   ua,
      referer,
      origin,
      host,
      body_preview,
      headers_snapshot: {
        "user-agent":      ua,
        "accept":          req.headers.get("accept") ?? "",
        "accept-language": req.headers.get("accept-language") ?? "",
        "accept-encoding": req.headers.get("accept-encoding") ?? "",
        "content-type":    req.headers.get("content-type") ?? "",
        "x-forwarded-for": req.headers.get("x-forwarded-for") ?? "",
      },
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[honeypot] DB log failed:", err);
  }
}

// Respond like a real (but slow) API so bots keep probing and keep logging
function trapResponse() {
  return NextResponse.redirect(REDIRECT, { status: 302 });
}

export async function GET(req: NextRequest) {
  await logEvent(req, "GET");
  return trapResponse();
}

export async function POST(req: NextRequest) {
  await logEvent(req, "POST");
  return trapResponse();
}

export async function PUT(req: NextRequest) {
  await logEvent(req, "PUT");
  return trapResponse();
}

export async function DELETE(req: NextRequest) {
  await logEvent(req, "DELETE");
  return trapResponse();
}

export async function PATCH(req: NextRequest) {
  await logEvent(req, "PATCH");
  return trapResponse();
}

export async function HEAD(req: NextRequest) {
  await logEvent(req, "HEAD");
  return new NextResponse(null, { status: 302, headers: { location: REDIRECT } });
}
