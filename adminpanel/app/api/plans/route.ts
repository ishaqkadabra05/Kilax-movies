import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/auth";
import { createUserDb } from "@/lib/supabase/user-db";

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
    const db = createUserDb();

    const { data, error } = await db
      .from("plans")
      .select(
        "id,name,tier,duration,duration_in_days,duration_in_months,duration_in_hours," +
        "amount,currency,description,recommended,active,stream_limit,download_limit," +
        "limit_window_hours,savings_percent,tier_label,badge,sort_order"
      )
      .eq("active", true)
      .order("sort_order", { ascending: true });

    if (error) throw error;

    const plans = (data || []).map((p: any) => ({
      id: p.id,
      name: p.name,
      display_name: p.tier_label ?? p.name,
      tier: (p.tier ?? "basic").toLowerCase(),
      duration: p.duration ?? null,
      duration_days: p.duration_in_days ?? null,
      duration_months: p.duration_in_months ?? null,
      duration_hours: p.duration_in_hours ?? null,
      amount: p.amount ?? 0,
      currency: p.currency ?? "UGX",
      description: p.description ?? "",
      recommended: p.recommended ?? false,
      badge: p.badge ?? null,
      sort_order: p.sort_order ?? 0,
      stream_limit: p.stream_limit ?? null,       // null = unlimited
      download_limit: p.download_limit ?? null,   // null = unlimited
      limit_window_hours: p.limit_window_hours ?? 24,
      savings_percent: p.savings_percent ?? 0,
    }));

    return NextResponse.json({ plans });
  } catch (error) {
    const status = error instanceof Response ? error.status : 502;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load plans" },
      { status }
    );
  }
}
