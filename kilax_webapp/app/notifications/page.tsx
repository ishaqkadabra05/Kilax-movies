"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Bell, Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { AppNotification } from "@/lib/types/media";

export default function NotificationsPage() {
  const router = useRouter();
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

  const markAsRead = async (notificationId: string) => {
    setNotifications((current) =>
      current.map((item) =>
        item.id === notificationId ? { ...item, read_at: new Date().toISOString() } : item,
      ),
    );

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ notificationId }),
      });
    } catch { /* reading is best effort */ }
  };

  const openNotification = async (notification: AppNotification) => {
    if (!notification.read_at) {
      await markAsRead(notification.id);
    }
    if (notification.url) {
      router.push(notification.url);
    }
  };

  return (
    <main className="min-h-screen bg-[#05070e] px-4 py-12 text-white sm:px-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => router.back()}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-200 transition hover:bg-white/10"
              aria-label="Go back"
            >
              <ArrowLeft size={16} />
              Back
            </button>
            <Bell className="text-orange-400" />
            <h1 className="text-3xl font-bold">Notifications</h1>
          </div>
        </div>
        {loading ? <p className="text-gray-400">Loading notifications...</p> : notifications.length === 0 ? <p className="text-gray-400">You have no notifications yet.</p> : (
          <div className="space-y-3">
            {notifications.map((notification) => (
              <div key={notification.id} className="flex w-full items-start gap-4 rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="relative h-16 w-12 shrink-0 overflow-hidden rounded-lg bg-slate-800/80">
                  {notification.thumbnail ? (
                    <img src={notification.thumbnail} alt={notification.title} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xl">{notification.icon || "🔔"}</div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => void openNotification(notification)}
                  className="min-w-0 flex-1 rounded-lg p-1 text-left hover:bg-white/5"
                >
                  <span className="flex items-center gap-2 font-semibold">
                    {notification.title}
                    {notification.read_at && <Check size={14} className="text-emerald-400" />}
                  </span>
                  <span className="mt-1 block text-sm leading-6 text-gray-400">{notification.body}</span>
                  <span className="mt-2 block text-xs text-gray-600">{new Date(notification.created_at).toLocaleString()}</span>
                </button>
                {!notification.read_at && (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      void markAsRead(notification.id);
                    }}
                    className="shrink-0 rounded-md border border-orange-500/30 bg-orange-500/10 px-2.5 py-1.5 text-xs font-medium text-orange-200 transition hover:bg-orange-500/20"
                  >
                    Mark as read
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
