import { NextRequest, NextResponse } from "next/server";
import { reelplexiFetch } from "@/lib/reelplexi";
import { requireAdmin } from "@/lib/supabase/auth";

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
    const path = request.nextUrl.searchParams.get("path");
    if (!path || !path.startsWith("/v1/")) {
      return NextResponse.json({ error: "Invalid Reelplexi path" }, { status: 400 });
    }
    const query = new URLSearchParams(request.nextUrl.searchParams);
    query.delete("path");
    const suffix = query.toString() ? `?${query}` : "";
    // Cache content list responses for 5 minutes
    const data = await reelplexiFetch(`${path}${suffix}`, { cacheTtl: 5 * 60 });
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Reelplexi request failed" },
      { status: 502 }
    );
  }
}
