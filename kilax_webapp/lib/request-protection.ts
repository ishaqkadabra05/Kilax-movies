import { NextRequest, NextResponse } from "next/server";

// ─── Redirect destination for caught bots ─────────────────────────────────────
const REDIRECT_URL =
  "https://www.google.com/search?q=suspicious+software+detected+please+contact+support";

// ─── Payment rate-limit config ────────────────────────────────────────────────
// Applies to POST /api/marzpay/initiate and POST /api/payment/complete.
// Uses an in-memory sliding-window counter per IP — works on the Edge Runtime.
// Values: max N attempts within WINDOW_MS milliseconds per IP.
const PAYMENT_PATHS = [
  "/api/marzpay/initiate",
  "/api/payment/complete",
  "/api/payment/initiate",
  "/api/makypay/initiate",
];
const MEDIA_PATHS = ["/api/stream", "/api/download", "/api/reelplexi/stream"];
const PAYMENT_WINDOW_MS = 10 * 60 * 1000; // 10-minute window
const PAYMENT_MAX       = 5;              // max 5 attempts per window per IP
const PAYMENT_BLOCK_MS  = 30 * 60 * 1000; // block for 30 min after exceeding

// In-memory store — cleared on cold start, sufficient for edge rate limiting.
// Key: ip address   Value: { timestamps: number[], blockedUntil?: number }
const paymentAttempts = new Map<string, { ts: number[]; blockedUntil?: number }>();
const mediaAttempts = new Map<string, { ts: number[]; blockedUntil?: number }>();

function checkMediaRateLimit(ip: string): { allowed: boolean; retryAfter: number } {
  const now = Date.now();
  const entry = mediaAttempts.get(ip) ?? { ts: [] };
  const windowMs = 60 * 1000;
  const max = 120;
  const blockMs = 10 * 60 * 1000;
  if (entry.blockedUntil && now < entry.blockedUntil) return { allowed: false, retryAfter: Math.ceil((entry.blockedUntil - now) / 1000) };
  entry.ts = entry.ts.filter((timestamp) => now - timestamp < windowMs);
  entry.ts.push(now);
  if (entry.ts.length > max) {
    entry.blockedUntil = now + blockMs;
    mediaAttempts.set(ip, entry);
    return { allowed: false, retryAfter: Math.ceil(blockMs / 1000) };
  }
  mediaAttempts.set(ip, entry);
  return { allowed: true, retryAfter: 0 };
}

function checkPaymentRateLimit(ip: string): { allowed: boolean; retryAfter: number } {
  const now   = Date.now();
  const entry = paymentAttempts.get(ip) ?? { ts: [] };

  // Still in block window?
  if (entry.blockedUntil && now < entry.blockedUntil) {
    return { allowed: false, retryAfter: Math.ceil((entry.blockedUntil - now) / 1000) };
  }

  // Slide the window — keep only timestamps within the last WINDOW_MS
  entry.ts = entry.ts.filter((t) => now - t < PAYMENT_WINDOW_MS);
  entry.ts.push(now);

  if (entry.ts.length > PAYMENT_MAX) {
    entry.blockedUntil = now + PAYMENT_BLOCK_MS;
    paymentAttempts.set(ip, entry);
    console.warn(`[rate-limit] Payment blocked ip=${ip} attempts=${entry.ts.length}`);
    return { allowed: false, retryAfter: Math.ceil(PAYMENT_BLOCK_MS / 1000) };
  }

  paymentAttempts.set(ip, entry);
  return { allowed: true, retryAfter: 0 };
}

// Periodically prune stale entries so the map doesn't grow unbounded
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of paymentAttempts) {
    const allOld    = entry.ts.every((t) => now - t >= PAYMENT_WINDOW_MS);
    const unblocked = !entry.blockedUntil || now >= entry.blockedUntil;
    if (allOld && unblocked) paymentAttempts.delete(ip);
  }
  for (const [ip, entry] of mediaAttempts) {
    const allOld = entry.ts.every((timestamp) => now - timestamp >= 60 * 1000);
    const unblocked = !entry.blockedUntil || now >= entry.blockedUntil;
    if (allOld && unblocked) mediaAttempts.delete(ip);
  }
}, 5 * 60 * 1000); // prune every 5 min

// ─── Known bad bot / scraper / tool user-agent fragments ─────────────────────
// Covers: headless browsers, common scrapers, AI training crawlers, vuln scanners,
// SEO crawlers, curl/wget/python automation, and penetration testing tools.
const BAD_UA_PATTERNS = [
  "internet download manager", "idm/", "aria2", "qbittorrent", "bittorrent", "transmission", "deluge", "utorrent",
  // Headless browsers
  "headlesschrome", "headless", "phantomjs", "slimerjs", "puppeteer",
  "playwright", "selenium", "webdriver", "htmlunit",
  // Generic scrapers / http clients
  "python-requests", "python-httpx", "python-urllib", "aiohttp",
  "scrapy", "mechanize", "wget/", "curl/", "httpie", "libwww-perl",
  "java/", "okhttp", "go-http-client", "ruby", "perl/",
  "axios/", "node-fetch", "got/", "undici",
  // Vuln / pentest scanners
  "nikto", "sqlmap", "nmap", "masscan", "nessus", "openvas",
  "w3af", "acunetix", "burpsuite", "zgrab", "dirbuster",
  "gobuster", "feroxbuster", "nuclei", "wfuzz", "ffuf",
  // AI / data harvesting crawlers
  "gptbot", "chatgpt", "claudebot", "anthropic", "cohere",
  "ccbot", "omgili", "dataforseo", "semrushbot", "ahrefsbot",
  "mj12bot", "dotbot", "blexbot", "exabot", "sistrix",
  // Generic bad actors
  "masscan", "zgrab", "netcraft", "shodan", "censys", "binaryedge",
  "scanbot", "scanner", "harvester", "extractor", "download-manager",
  "download manager", "httrack", "teleport", "webcopier", "webzip",
  "siteripper", "offline explorer",
];

// ─── Suspicious request patterns ─────────────────────────────────────────────
// Paths that legitimate users never visit but scanners always do.
const HONEYPOT_PATHS = [
  "/admin",
  "/wp-admin",
  "/wp-login.php",
  "/.env",
  "/.git",
  "/config",
  "/phpinfo.php",
  "/etc/passwd",
  "/server-status",
  "/actuator",
  "/api/trap",          // our explicit honeypot — hits here get logged + banned
];

// Paths / extensions that only automated tools request
const SCANNER_PATH_PATTERNS = [
  /\.(php|asp|aspx|jsp|cgi|sh|bash|py|rb|pl|exe|dll|bat|cmd|vbs)$/i,
  /\/\.(env|git|svn|htaccess|htpasswd|ssh|aws|docker|kube)/i,
  /\/(backup|bak|old|tmp|temp|dump|sql|archive)\b/i,
  /\/(xmlrpc|phpmyadmin|mysql|postgres|redis|mongo)\b/i,
  /\/(eval|base64|exec|system|passthru|shell_exec)\b/i,
];

// ─── Allowed path prefixes (never block these) ────────────────────────────────
const ALLOWED_PREFIXES = [
  "/_next/",
  "/favicon",
  "/logo",
  "/manifest",
  "/OneSignal",
  "/api/security/",   // reCAPTCHA verify — must work
];

// Legitimate search-engine bots we want to allow (SEO)
const GOOD_BOTS = [
  "googlebot", "bingbot", "slurp", "duckduckbot", "baiduspider",
  "yandexbot", "facebot", "twitterbot", "linkedinbot", "applebot",
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
function isBadUA(ua: string): boolean {
  const lower = ua.toLowerCase();
  // Allow legit bots first
  if (GOOD_BOTS.some((g) => lower.includes(g))) return false;
  return BAD_UA_PATTERNS.some((p) => lower.includes(p));
}

function isHoneypotPath(pathname: string): boolean {
  return HONEYPOT_PATHS.some((hp) =>
    pathname === hp || pathname.startsWith(hp + "/")
  );
}

function isScannerPath(pathname: string): boolean {
  return SCANNER_PATH_PATTERNS.some((re) => re.test(pathname));
}

function isSuspiciousHeaders(req: NextRequest): boolean {
  // Requests with no user-agent or no accept header are almost always bots
  const ua     = req.headers.get("user-agent") || "";
  const accept = req.headers.get("accept") || "";

  if (!ua) return true;
  if (ua.length < 10) return true;               // too short to be real
  if (accept === "*/*" && !ua.includes("curl")) { // raw */* without context
    // Only flag if combined with other signals — don't block alone
  }
  return false;
}

function buildRedirect(req: NextRequest): NextResponse {
  // Log to console (Vercel / server logs) — the /api/trap route does DB logging
  const ip  = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const ua  = req.headers.get("user-agent") ?? "none";
  const url = req.nextUrl.pathname;
  console.warn(`[security] Suspicious request blocked | ip=${ip} path=${url} ua=${ua}`);
  return NextResponse.redirect(REDIRECT_URL, { status: 302 });
}

// ─── Middleware ───────────────────────────────────────────────────────────────
export function requestProtection(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const method = req.method;

  // Never touch Next.js internals or static assets
  if (ALLOWED_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const ua = req.headers.get("user-agent") || "";
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? req.headers.get("x-real-ip")
    ?? "unknown";

  // ── Payment rate limiting (before bot checks so legit users get clear msg) ──
  if (method === "POST" && PAYMENT_PATHS.some((p) => pathname.startsWith(p))) {
    const { allowed, retryAfter } = checkPaymentRateLimit(ip);
    if (!allowed) {
      console.warn(`[rate-limit] Payment attempt blocked ip=${ip} path=${pathname}`);
      return NextResponse.json(
        {
          error: "Too many payment attempts. Please wait before trying again.",
          retryAfter,
        },
        {
          status: 429,
          headers: {
            "Retry-After":       String(retryAfter),
            "X-RateLimit-Reset": String(Math.floor((Date.now() + retryAfter * 1000) / 1000)),
          },
        }
      );
    }
  }

  if (MEDIA_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    const { allowed, retryAfter } = checkMediaRateLimit(ip);
    if (!allowed) return NextResponse.json({ error: "Too many media requests", retryAfter }, { status: 429, headers: { "Retry-After": String(retryAfter) } });
  }

  // 1. Honeypot paths — any hit here is definitely a bot / scanner
  if (isHoneypotPath(pathname)) {
    // Let /api/trap handle its own response (it logs to Supabase)
    if (pathname.startsWith("/api/trap")) return NextResponse.next();
    return buildRedirect(req);
  }

  // 2. Scanner path patterns (PHP files, .env, .git, etc.)
  if (isScannerPath(pathname)) {
    return buildRedirect(req);
  }

  // 3. Known bad user-agents
  if (isBadUA(ua)) {
    return buildRedirect(req);
  }

  // 4. Missing user-agent entirely (raw HTTP clients)
  if (!ua) {
    return buildRedirect(req);
  }

  return NextResponse.next();
}

export const config = {
  // Run on all routes except Next.js internals and static files
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico).*)",
  ],
};
