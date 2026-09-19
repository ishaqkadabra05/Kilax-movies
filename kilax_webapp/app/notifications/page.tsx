"use client";

import { useEffect, useState } from "react";
import { Bell, Check } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { AppNotification } from "@/lib/types/media";

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) return;
        const response = await fetch("/api/notifications", {
          headers: { Authorization: `Bearer ${session.access_token}` },
          cache: "no-store",
        });
        const payload = await response.json();
        if (active) setNotifications(Array.isArray(payload.notifications) ? payload.notifications : []);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const openNotification = async (notification: AppNotification) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        await fetch("/api/notifications", {
          method: "PATCH",
          headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ notificationId: notification.id }),
        });
      }
    } catch { /* reading is best effort */ }
    if (notification.url) window.location.href = notification.url;
  };

  return (
    <main className="min-h-screen bg-[#05070e] px-4 py-12 text-white sm:px-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8 flex items-center gap-3">
          <Bell className="text-orange-400" />
          <h1 className="text-3xl font-bold">Notifications</h1>
        </div>
        {loading ? <p className="text-gray-400">Loading notifications...</p> : notifications.length === 0 ? <p className="text-gray-400">You have no notifications yet.</p> : (
          <div className="space-y-3">
            {notifications.map((notification) => (
              <button key={notification.id} onClick={() => void openNotification(notification)} className="flex w-full items-start gap-4 rounded-xl border border-white/10 bg-white/[.04] p-4 text-left hover:bg-white/[.08]">
                <span className="text-2xl">{notification.icon || "🔔"}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 font-semibold">{notification.title}{notification.read_at && <Check size={14} className="text-emerald-400" />}</span>
                  <span className="mt-1 block text-sm leading-6 text-gray-400">{notification.body}</span>
                  <span className="mt-2 block text-xs text-gray-600">{new Date(notification.created_at).toLocaleString()}</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
