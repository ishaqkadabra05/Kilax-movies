"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { trackNotificationEvent } from "@/lib/firebase";

export default function OneSignalPrompt() {
  const [ready, setReady] = useState(false);
  const [open,  setOpen]  = useState(false);
  const { user } = useAuth();
  const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;

  // Only mount OneSignal listeners when the SDK script is present AND has
  // initialised successfully (production only — the script tag is omitted in dev).
  useEffect(() => {
    if (!appId || typeof window === "undefined") return;
    const w = window as any;
    if (!w.OneSignalDeferred) return; // script not loaded (dev / blocked)

    w.OneSignalDeferred.push(async (OneSignal: any) => {
      // Verify init actually succeeded before treating SDK as ready
      if (!OneSignal?.Notifications) return;
      // The deferred callback receives the initialized instance, but some SDK
      // builds do not expose it on window until a later tick.
      w.OneSignal = OneSignal;
      setReady(true);
      const permission = OneSignal.Notifications.permission;
      if (
        permission !== true &&
        localStorage.getItem("kilax-notification-dismissed") !== "1"
      ) {
        setOpen(true);
        void trackNotificationEvent("onesignal_prompt_shown");
      }
    });
  }, [appId]);

  // Link / unlink the Supabase user ID with OneSignal external_id.
  // Only runs when the SDK is confirmed ready (ready === true).
  useEffect(() => {
    if (!ready || typeof window === "undefined") return;
    const OneSignal = (window as any).OneSignal;
    // Guard: OneSignal.login exists only after a successful init on a
    // whitelisted domain. On localhost / misconfigured environments it will
    // be undefined — skip silently instead of throwing.
    if (!OneSignal?.login) return;
    if (user?.id) {
      void OneSignal.login(user.id).catch((err: unknown) =>
        console.warn("[OneSignal] login failed:", err)
      );
    } else {
      OneSignal.logout?.().catch((err: unknown) =>
        console.warn("[OneSignal] logout failed:", err)
      );
    }
  }, [ready, user?.id]);

  if (!appId || !ready || !open) return null;

  const request = async () => {
    try {
      await (window as any).OneSignal.Notifications.requestPermission();
      const granted = (window as any).OneSignal.Notifications.permission === true;
      void trackNotificationEvent(
        granted ? "onesignal_permission_granted" : "onesignal_permission_dismissed"
      );
    } finally {
      setOpen(false);
    }
  };

  const dismiss = () => {
    localStorage.setItem("kilax-notification-dismissed", "1");
    void trackNotificationEvent("onesignal_permission_dismissed");
    setOpen(false);
  };

  return (
    <div className="notification-prompt" role="dialog" aria-label="Notification permission">
      <button className="notification-prompt-close" onClick={dismiss} aria-label="Close">
        <X size={16} />
      </button>
      <div className="notification-prompt-icon" style={{ overflow: "hidden", padding: 0 }}>
        <img
          src="/logo-512.png"
          alt="Kilax Movies"
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      </div>
      <div>
        <strong>Stay updated on Kilax Movies</strong>
        <p>Get new movie, series and episode alerts when you choose.</p>
      </div>
      <div className="notification-prompt-actions">
        <button onClick={request}>Allow notifications</button>
        <button onClick={dismiss}>Not now</button>
      </div>
    </div>
  );
}
