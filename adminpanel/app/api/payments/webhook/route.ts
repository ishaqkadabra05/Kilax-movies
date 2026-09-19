import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

function verifySignature(rawBody: string, timestamp: string, signatureHeader: string, secret: string) {
  const match = signatureHeader.match(/v1=([a-f0-9]+)/i);
  if (!match) return false;
  const expected = crypto.createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  const received = match[1];
  return received.length === expected.length && crypto.timingSafeEqual(Buffer.from(received), Buffer.from(expected));
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const secret = process.env.PAYMENT_WEBHOOK_SECRET;
  const timestamp = request.headers.get("x-marzpay-timestamp") || "";
  const signature = request.headers.get("x-marzpay-signature") || "";

  if (secret && (!timestamp || !signature || !verifySignature(rawBody, timestamp, signature, secret))) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  try {
    const payload = JSON.parse(rawBody) as {
      event_type?: string;
      transaction?: { uuid?: string; reference?: string; status?: string; amount?: { raw?: number; currency?: string } };
      collection?: { provider_transaction_id?: string; provider?: string; phone_number?: string };
      metadata?: Array<Record<string, unknown>>;
    };
    const admin = createSupabaseAdmin();
    const row = {
      reference: payload.transaction?.reference || null,
      status: payload.transaction?.status || payload.event_type || null,
      amount: payload.transaction?.amount?.raw ?? null,
      currency: payload.transaction?.amount?.currency || null,
      provider: payload.collection?.provider || null,
      provider_transaction_id: payload.collection?.provider_transaction_id || null,
      phone_number: payload.collection?.phone_number || null,
      metadata: payload.metadata || [],
      raw_payload: payload,
      updated_at: new Date().toISOString(),
    };
    let existing: any = null;
    if (row.provider_transaction_id) {
      const found = await admin.from("transactions").select("id").eq("provider_transaction_id", row.provider_transaction_id).maybeSingle();
      existing = found.data;
    }
    if (existing?.id) {
      const { error } = await admin.from("transactions").update(row).eq("id", existing.id);
      if (error) throw error;
    } else {
      const { error } = await admin.from("transactions").insert(row);
      if (error) throw error;
    }
    return NextResponse.json({ received: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid webhook" }, { status: 400 });
  }
}
