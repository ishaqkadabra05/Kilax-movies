import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/auth";
import { createUserDb } from "@/lib/supabase/user-db";

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
    const db = createUserDb();

    let query = db
      .from("plans")
      .select(
        "id,name,tier,duration,duration_in_days,duration_in_months,duration_in_hours," +
        "amount,currency,description,recommended,active,stream_limit,download_limit," +
        "limit_window_hours,savings_percent,tier_label,badge,sort_order"
      );

    if (request.nextUrl.searchParams.get("include_inactive") !== "true") {
      query = query.eq("active", true);
    }

    const { data, error } = await query.order("sort_order", { ascending: true });

    if (error) throw error;

    const plans = (data || []).map((p: any) => ({
      id: p.id,
      name: p.name,
      display_name: p.tier_label ?? p.name,
      tier: (p.tier ?? "basic").toLowerCase(),
      duration: p.duration ?? null,
      duration_in_days: p.duration_in_days ?? null,
      duration_days: p.duration_in_days ?? null,
      duration_months: p.duration_in_months ?? null,
      duration_in_months: p.duration_in_months ?? null,
      duration_hours: p.duration_in_hours ?? null,
      duration_in_hours: p.duration_in_hours ?? null,
      amount: p.amount ?? 0,
      currency: p.currency ?? "UGX",
      description: p.description ?? "",
      recommended: p.recommended ?? false,
      active: p.active ?? true,
      tier_label: p.tier_label ?? null,
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

const PLAN_FIELDS = [
  "name", "tier", "duration", "duration_in_days", "duration_in_months",
  "duration_in_hours", "amount", "currency", "description", "recommended",
  "active", "stream_limit", "download_limit", "limit_window_hours",
  "savings_percent", "tier_label", "badge", "sort_order",
] as const;

function validatePlan(body: Record<string, unknown>) {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const tier = typeof body.tier === "string" ? body.tier.trim().toLowerCase() : "";
  const duration = typeof body.duration === "string" ? body.duration.trim() : "";
  const amount = Number(body.amount);
  const currency = typeof body.currency === "string" ? body.currency.trim().toUpperCase() : "UGX";

  if (!name || !duration || !["basic", "standard", "pro"].includes(tier)) {
    return { error: "Name, duration, and a valid tier are required" };
  }
  if (!Number.isFinite(amount) || amount < 0) {
    return { error: "Amount must be a non-negative number" };
  }

  for (const field of ["duration_in_days", "duration_in_months", "duration_in_hours", "stream_limit", "download_limit"]) {
    const value = body[field];
    if (value === null || value === undefined || value === "") continue;
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return { error: `${field} must be a non-negative number or empty` };
    }
    if (["duration_in_days", "duration_in_hours"].includes(field) && (!Number.isInteger(parsed) || parsed <= 0)) {
      return { error: `${field} must be a positive whole number or empty` };
    }
    if (["stream_limit", "download_limit"].includes(field) && !Number.isInteger(parsed)) {
      return { error: `${field} must be a whole number or empty` };
    }
    if (field === "duration_in_months" && parsed <= 0) {
      return { error: `${field} must be a positive number or empty` };
    }
  }

  const limitWindowHours = Number(body.limit_window_hours ?? 24);
  if (!Number.isInteger(limitWindowHours) || limitWindowHours <= 0) {
    return { error: "Limit window must be a positive whole number of hours" };
  }

  const numericValue = (field: string) => {
    const value = body[field];
    return value === null || value === undefined || value === "" ? null : Number(value);
  };
  const textValue = (field: string) => {
    const value = body[field];
    return typeof value === "string" && value.trim() ? value.trim() : null;
  };
  const plan = {
    name,
    tier,
    duration,
    amount,
    currency: currency || "UGX",
    description: typeof body.description === "string" ? body.description.trim() : "",
    recommended: body.recommended === true,
    active: body.active !== false,
    duration_in_days: numericValue("duration_in_days"),
    duration_in_months: numericValue("duration_in_months"),
    duration_in_hours: numericValue("duration_in_hours"),
    stream_limit: numericValue("stream_limit"),
    download_limit: numericValue("download_limit"),
    limit_window_hours: limitWindowHours,
    savings_percent: Number(body.savings_percent ?? 0),
    tier_label: textValue("tier_label"),
    badge: textValue("badge"),
    sort_order: Number(body.sort_order ?? 0),
  };

  if (!Number.isFinite(plan.savings_percent) || plan.savings_percent < 0 || !Number.isInteger(plan.sort_order)) {
    return { error: "Savings percent must be non-negative and sort order must be a whole number" };
  }
  return { plan };
}

async function readPlanBody(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  return body as Record<string, unknown>;
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request);
    const body = await readPlanBody(request);
    if (!body) return NextResponse.json({ error: "A plan payload is required" }, { status: 400 });
    const result = validatePlan(body);
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });

    const db = createUserDb();
    const { data, error } = await db.from("plans").insert(result.plan).select("id").single();
    if (error) throw error;
    return NextResponse.json({ success: true, id: data.id }, { status: 201 });
  } catch (error) {
    const status = error instanceof Response ? error.status : 502;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to create plan" }, { status });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await requireAdmin(request);
    const body = await readPlanBody(request);
    const id = typeof body?.id === "string" ? body.id : "";
    if (!body || !id) return NextResponse.json({ error: "Plan id and plan details are required" }, { status: 400 });
    const result = validatePlan(body);
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });

    const fields = Object.fromEntries(PLAN_FIELDS.map(field => [field, result.plan[field]]));
    const db = createUserDb();
    const { error } = await db.from("plans").update(fields).eq("id", id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    const status = error instanceof Response ? error.status : 502;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to update plan" }, { status });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await requireAdmin(request);
    const id = request.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Plan id is required" }, { status: 400 });

    const db = createUserDb();
    const [subscriptions, transactions] = await Promise.all([
      db.from("subscriptions").select("id", { count: "exact", head: true }).eq("plan_id", id),
      db.from("transactions").select("id", { count: "exact", head: true }).eq("plan_id", id),
    ]);
    if (subscriptions.error) throw subscriptions.error;
    if (transactions.error) throw transactions.error;
    if ((subscriptions.count ?? 0) > 0 || (transactions.count ?? 0) > 0) {
      return NextResponse.json({ error: "This plan is referenced by subscriptions or transactions. Deactivate it instead." }, { status: 409 });
    }

    const { error } = await db.from("plans").delete().eq("id", id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    const status = error instanceof Response ? error.status : 502;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to delete plan" }, { status });
  }
}
