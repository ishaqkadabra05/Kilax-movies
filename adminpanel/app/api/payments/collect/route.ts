import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createPaymentCollection } from "@/lib/payment-provider";
import { requireAdmin } from "@/lib/supabase/auth";

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request);
    const body = await request.json();
    const result = await createPaymentCollection({
      amount: Number(body.amount),
      phone_number: body.phone_number,
      country: body.country || "UG",
      reference: randomUUID(),
      description: body.description,
      callback_url: `${process.env.APP_URL || request.nextUrl.origin}/api/payments/webhook`,
      method: body.method || "mobile_money",
      metadata: body.metadata,
    });
    return NextResponse.json(result);
  } catch (error) {
    const status = error instanceof Response ? error.status : 502;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unauthorized" }, { status });
  }
}
