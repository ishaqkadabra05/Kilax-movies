import { NextRequest, NextResponse } from "next/server";
import { requestProtection } from "./lib/request-protection";

export function proxy(request: NextRequest) {
  const protectionResponse = requestProtection(request);
  if (protectionResponse.status !== 200) return protectionResponse;

  const response = NextResponse.next();
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "SAMEORIGIN");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  response.headers.set("X-DNS-Prefetch-Control", "on");
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest).*)'],
};
