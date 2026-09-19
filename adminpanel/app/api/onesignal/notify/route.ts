import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/auth";
import { createUserDb } from "@/lib/supabase/user-db";
import { sendOneSignalNotification } from "@/lib/onesignal";

/**
 * POST /api/onesignal/notify
 *
 * Sends a push notification via OneSignal AND saves it as an in-app
 * notification in Supabase (notifications + notification_recipients tables).
 *
 * Body: { title, message, url?, externalIds? }
 *   - externalIds: optional array of Supabase user UUIDs to target
 *   - if omitted, sends to ALL subscribers
 */
export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request);

    const body = await request.json().catch(() => ({}));
    const title   = typeof body.title   === "string" ? body.title.trim()   : "";
    const message = typeof body.message === "string" ? body.message.trim() : "";
    const url     = typeof body.url     === "string" ? body.url.trim() || null : null;
    const externalIds: string[] = Array.isArray(body.externalIds)
      ? body.externalIds.filter((id: unknown): id is string => typeof id === "string")
      : [];

    if (!title || !message) {
      return NextResponse.json({ error: "Title and message are required" }, { status: 400 });
    }

    const db = createUserDb();

    // ── 1. Save notification to Supabase (in-app) ─────────────────────────
    const { data: notification, error: notifError } = await db
      .from("notifications")
      .insert({ title, body: message, url, data: { source: "admin_panel" } })
      .select("id")
      .single() as { data: { id: string } | null; error: any };

    if (notifError || !notification) {
      console.error("[notify] Failed to insert notification:", notifError?.message);
      // Don't block push because of DB error
    }

    // ── 2. Assign recipients in Supabase ──────────────────────────────────
    if (notification?.id) {
      const { data: recipientRows } = externalIds.length
        ? await db.from("profiles").select("id").in("id", externalIds)
        : await db.from("profiles").select("id");

      const userIds = (recipientRows || []).map((r: any) => String(r.id));
      if (userIds.length > 0) {
        await db.from("notification_recipients").insert(
          userIds.map((userId) => ({ notification_id: notification.id, user_id: userId }))
        );
      }
    }

    // ── 3. Send OneSignal push ─────────────────────────────────────────────
    let pushResult: any = null;
    let pushDelivered   = false;
    let pushError       = "";

    try {
      pushResult = await sendOneSignalNotification({
        title,
        message,
        url: url ?? undefined,
        externalIds: externalIds.length ? externalIds : undefined,
      });
      const recipientCount = Number(pushResult?.recipients ?? 0);
      pushDelivered = recipientCount > 0;
      if (!pushDelivered) {
        pushError = "OneSignal accepted the request but reported zero subscribed recipients. Check the website domain, notification permission, and OneSignal user identity registration.";
      }
    } catch (err) {
      pushError = err instanceof Error ? err.message : "OneSignal push failed";
      console.error("[notify] OneSignal push failed:", pushError);
    }

    return NextResponse.json({
      ok:           true,
      notificationId: notification?.id ?? null,
      pushDelivered,
      ...(pushError ? { warning: pushError } : {}),
      ...(pushResult ? { oneSignal: pushResult } : {}),
    }, { status: pushDelivered ? 200 : 207 });

  } catch (error) {
    const status = error instanceof Response ? error.status : 502;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Notification failed" },
      { status }
    );
  }
}
