import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/auth";
import { syncNewReelplexContentNotifications } from "@/lib/reelplex-content-notifications";

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request);
    const result = await syncNewReelplexContentNotifications();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const status = error instanceof Response ? error.status : 502;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to sync ReelPlex notifications" },
      { status }
    );
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}
