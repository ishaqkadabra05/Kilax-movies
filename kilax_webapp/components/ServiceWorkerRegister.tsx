"use client";

import { useEffect } from "react";

export default function ServiceWorkerRegister() {
  useEffect(() => {
    const isSecureEnvironment =
      window.isSecureContext ||
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1";

    if (!("serviceWorker" in navigator) || !isSecureEnvironment) return;

    // Production already uses OneSignal's root-scope worker. Registering a second
    // root-scope SW here creates the Chrome postMessage / async channel conflicts and
    // the noisy WM warnings reported in the console.
    if (process.env.NODE_ENV === "production") return;

    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((error) => {
      console.warn("Service worker registration skipped:", error);
    });
  }, []);
  return null;
}
