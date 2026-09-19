import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendOneSignalNotification } from "@/lib/onesignal";
import { supabaseAdmin } from "@/lib/supabase";

async function authorizeAdmin(req: NextRequest) {
  const header = req.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return null;
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user } } = await client.auth.getUser();
  if (!user) return null;
  const { data: profile } = await (supabaseAdmin as any).from("profiles").select("role").eq("id", user.id).maybeSingle() as { data: { role?: string | null } | null };
  return profile?.role === "admin" ? user : null;
}

export async function POST(req: NextRequest) {
  const admin = await authorizeAdmin(req);
  if (!admin) return NextResponse.json({ error: "Administrator access required" }, { status: 403 });

  const input = await req.json().catch(() => ({}));
  const title = typeof input.title === "string" ? input.title.trim() : "";
  const message = typeof input.body === "string" ? input.body.trim() : "";
  const url = typeof input.url === "string" ? input.url.trim() || null : null;
  const requestedUserIds = Array.isArray(input.userIds) ? input.userIds.filter((id: unknown): id is string => typeof id === "string") : [];
  if (!title || !message || title.length > 100 || message.length > 500) {
    return NextResponse.json({ error: "A title and body are required (100 and 500 characters maximum)." }, { status: 400 });
  }

  const { data: recipients, error: recipientError } = (requestedUserIds.length
    ? await (supabaseAdmin as any).from("profiles").select("id").in("id", requestedUserIds)
    : await (supabaseAdmin as any).from("profiles").select("id")) as { data: Array<{ id: string }> | null; error: { message: string } | null };
  if (recipientError || !recipients?.length) return NextResponse.json({ error: "No notification recipients found" }, { status: 400 });
  const userIds = recipients.map((row) => row.id as string);

  const { data: notification, error: notificationError } = await (supabaseAdmin as any)
    .from("notifications")
    .insert({ title, body: message, url, data: { source: "admin" } })
    .select("id")
    .single();
  if (notificationError || !notification) return NextResponse.json({ error: "Unable to create notification" }, { status: 500 });

  const { error: insertError } = await (supabaseAdmin as any).from("notification_recipients").insert(
    userIds.map((userId) => ({ notification_id: notification.id, user_id: userId })),
  );
  if (insertError) return NextResponse.json({ error: "Unable to assign notification recipients" }, { status: 500 });

  try {
    await sendOneSignalNotification({ title, body: message, url, data: { notificationId: notification.id } }, userIds);
  } catch (error) {
    console.error("OneSignal notification failed:", error);
    return NextResponse.json({ ok: true, notificationId: notification.id, pushDelivered: false, warning: "Saved in-app, but push delivery failed" }, { status: 207 });
  }
  return NextResponse.json({ ok: true, notificationId: notification.id, pushDelivered: true });
}
