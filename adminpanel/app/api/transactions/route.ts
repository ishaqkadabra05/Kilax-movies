import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/auth";
import { createUserDb } from "@/lib/supabase/user-db";

/** Fetches payment transactions from the unified public.transactions table. */
export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
    const db = createUserDb();
    const q = request.nextUrl.searchParams;

    const limit = Math.min(500, Math.max(1, Number(q.get("limit") || 50)));
    const statusFilter = q.get("status") ?? null;
    const fromFilter = q.get("from") ?? null;
    const toFilter = q.get("to") ?? null;
    const providerFilter = q.get("provider") ?? null;
    const identifier = q.get("identifier")?.trim() ?? "";

    const stalePendingCutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    await db.from("transactions")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .in("status", ["pending", "processing"])
      .lt("created_at", stalePendingCutoff);

    let query = db
      .from("transactions")
      .select("id,reference,user_id,amount,currency,payment_method,provider_reference,provider_transaction_id,phone_number,status,metadata,raw_payload,created_at,updated_at")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (statusFilter) query = query.ilike("status", `%${statusFilter}%`);
    if (fromFilter) query = query.gte("created_at", fromFilter);
    if (toFilter) query = query.lte("created_at", toFilter);
    if (providerFilter) query = query.ilike("payment_method", `%${providerFilter}%`);
    if (identifier) {
      query = query.or(`reference.eq.${identifier},provider_transaction_id.eq.${identifier}`);
    }

    const { data, error } = await query;
    if (error) throw error;

    const transactions = (data || []).map((row: any) => ({
      id: row.id,
      reference: row.reference ?? row.provider_transaction_id ?? row.id,
      provider: row.payment_method ?? row.provider_reference ?? "—",
      user_id: row.user_id ?? null,
      phone_number: row.phone_number ?? null,
      amount: row.amount,
      currency: row.currency ?? "UGX",
      status: row.status ?? "—",
      description: row.metadata?.description ?? row.raw_payload?.description ?? null,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));

    return NextResponse.json(identifier ? (transactions[0] ?? null) : transactions);
  } catch (error) {
    const status = error instanceof Response ? error.status : 502;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to fetch transactions" },
      { status }
    );
  }
}
