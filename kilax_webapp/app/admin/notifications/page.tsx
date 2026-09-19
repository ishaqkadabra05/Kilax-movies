"use client";

import { FormEvent, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function AdminNotificationsPage() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("");
  const [userIds, setUserIds] = useState("");
  const [status, setStatus] = useState("");
  const [sending, setSending] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSending(true);
    setStatus("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Sign in with an administrator account first.");
      const response = await fetch("/api/admin/notifications", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          body,
          url: url ? new URL(url, window.location.origin).toString() : null,
          userIds: userIds.split(",").map((id) => id.trim()).filter(Boolean),
        }),
      });
      const result = await response.json();
      if (!response.ok && response.status !== 207) throw new Error(result.error || "Unable to send notification");
      setStatus(result.pushDelivered === false ? "Saved in-app, but push delivery failed." : "Notification sent in-app and to subscribed devices.");
      setTitle("");
      setBody("");
      setUrl("");
      setUserIds("");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to send notification");
    } finally {
      setSending(false);
    }
  };

  return (
    <main style={{ minHeight: "100vh", background: "#0d1117", color: "white", padding: "48px 24px", fontFamily: "'DM Sans', sans-serif" }}>
      <form onSubmit={submit} style={{ maxWidth: 620, margin: "0 auto", display: "grid", gap: 16 }}>
        <div>
          <p style={{ color: "#60a5fa", fontSize: 12, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase" }}>Kilax admin</p>
          <h1 style={{ margin: "8px 0", fontSize: 30 }}>Send a notification</h1>
          <p style={{ color: "#94a3b8", margin: 0 }}>Leave recipient IDs empty to notify every profile.</p>
        </div>
        <label>Title<input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={100} required style={inputStyle} /></label>
        <label>Message<textarea value={body} onChange={(event) => setBody(event.target.value)} maxLength={500} required rows={5} style={inputStyle} /></label>
        <label>In-app destination URL (optional)<input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="/movies" style={inputStyle} /></label>
        <label>Specific user IDs (optional, comma-separated)<input value={userIds} onChange={(event) => setUserIds(event.target.value)} placeholder="Leave blank for everyone" style={inputStyle} /></label>
        <button disabled={sending} type="submit" style={{ background: "#3b82f6", color: "white", border: 0, borderRadius: 10, padding: "12px 16px", fontWeight: 700, cursor: sending ? "wait" : "pointer" }}>{sending ? "Sending..." : "Send notification"}</button>
        {status && <p role="status" style={{ color: status.includes("failed") ? "#fbbf24" : "#86efac" }}>{status}</p>}
      </form>
    </main>
  );
}

const inputStyle = { display: "block", width: "100%", boxSizing: "border-box" as const, marginTop: 8, padding: "11px 12px", color: "white", background: "#161b2e", border: "1px solid rgba(255,255,255,.14)", borderRadius: 8, font: "inherit" };
