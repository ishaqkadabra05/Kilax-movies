import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase";

async function getUser(req: NextRequest) {
  const header = req.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return null;
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user } } = await client.auth.getUser();
  return user || null;
}

export async function GET(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  const { data, error } = await (supabaseAdmin as any)
    .from("notification_recipients")
    .select("notification_id, read_at, notifications(id, title, body, icon, url, data, created_at)")
    .eq("user_id", user.id)
    .limit(50);
  if (error) return NextResponse.json({ error: "Unable to load notifications" }, { status: 500 });

  const notifications = (data || [])
    .map((row: any) => {
      const notification = row.notifications || {};
      const lowerText = `${notification.title || ""} ${notification.body || ""}`.toLowerCase();
      const isActivationNotification =
        notification.data?.source === "subscription" ||
        notification.data?.source === "trial" ||
        /subscription activated|trial activated|activation|trial active|premium activated/.test(lowerText);

      const candidatePoster = [
        notification.data?.poster_url,
        notification.data?.poster,
        notification.data?.thumbnail_url,
        notification.data?.cover_image_url,
        notification.data?.thumbnail,
        notification.data?.image_url,
        notification.data?.image,
        notification.data?.backdrop_url,
        notification.data?.media_url,
        notification.icon,
      ].find((value) => typeof value === "string" && value.trim());

      const imageSource = isActivationNotification
        ? "/logo.png"
        : (candidatePoster && String(candidatePoster).trim()) || "/logo.png";

      return {
        ...notification,
        data: notification.data || null,
        thumbnail: imageSource,
        read_at: row.read_at,
      };
    })
    .filter((notification: any) => notification.id)
    .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return NextResponse.json({ notifications, unreadCount: notifications.filter((item: any) => !item.read_at).length });
}

export async function PATCH(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const notificationId = body.notificationId;
  if (notificationId !== "all" && typeof notificationId !== "string") {
    return NextResponse.json({ error: "notificationId is required" }, { status: 400 });
  }

  let query = (supabaseAdmin as any).from("notification_recipients").update({ read_at: new Date().toISOString() }).eq("user_id", user.id);
  if (notificationId !== "all") query = query.eq("notification_id", notificationId);
  const { error } = await query;
  if (error) return NextResponse.json({ error: "Unable to mark notification as read" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
