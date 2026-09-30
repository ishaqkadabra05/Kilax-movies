"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { getSessionAuthHeaders } from "@/lib/client-auth";

type ChannelDetails = { name?: string; embed_url?: string; error?: string; data?: { name?: string; embed_url?: string; channel?: ChannelDetails }; channel?: ChannelDetails };

export default function LiveTVStreamPage() {
  const { channelId } = useParams<{ channelId: string }>();
  const router = useRouter();
  const [channel, setChannel] = useState<{ name: string; embedUrl: string } | null>(null);
  const [error, setError] = useState("");
  const [accessDenied, setAccessDenied] = useState<"signin" | "standard" | null>(null);
  const [preparing, setPreparing] = useState(true);

  useEffect(() => {
    let active = true;
    setPreparing(true);
    setError("");
    setAccessDenied(null);
    getSessionAuthHeaders().then(headers => fetch(`/api/reelplexi/sports/channels/${encodeURIComponent(channelId)}`, { headers, cache: "no-store" }))
      .then(async response => {
        const payload: ChannelDetails = await response.json();
        if (!response.ok) {
          if (response.status === 401) setAccessDenied("signin");
          if (response.status === 403) setAccessDenied("standard");
          throw new Error(payload.error || "This live channel is unavailable.");
        }
        const details = payload.channel || payload.data?.channel || payload.data || payload;
        if (!details.embed_url) throw new Error("This live channel did not provide a player URL.");
        return { name: details.name || "Live TV", embedUrl: details.embed_url };
      })
      .then(details => { if (active) setChannel(details); })
      .catch(reason => { if (active) { setError(reason instanceof Error ? reason.message : "Unable to prepare this stream."); setPreparing(false); } });
    return () => { active = false; };
  }, [channelId]);

  return <main aria-busy={preparing} style={{ position: "fixed", inset: 0, width: "100vw", height: "100dvh", overflow: "hidden", background: "#000", color: "#fff" }}>
    {channel && <iframe key={channel.embedUrl} src={channel.embedUrl} title={channel.name} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen onLoad={() => setPreparing(false)} style={{ position: "absolute", inset: 0, display: "block", width: "100%", height: "100%", border: 0 }} />}
    <button onClick={() => router.push("/?page=livetvs")} aria-label="Back to Live TVs" title="Back to Live TVs" style={{ position: "absolute", top: "calc(env(safe-area-inset-top,0px) + 16px)", left: "calc(env(safe-area-inset-left,0px) + 16px)", zIndex: 3, width: 44, height: 44, display: "grid", placeItems: "center", border: "1px solid rgba(255,255,255,.18)", borderRadius: 999, background: "rgba(0,0,0,.66)", color: "white", cursor: "pointer", backdropFilter: "blur(8px)" }}><ArrowLeft size={20} /></button>
    {(preparing || error) && <div role="status" style={{ position: "absolute", inset: 0, zIndex: 1, display: "grid", placeContent: "center", justifyItems: "center", gap: 18, background: "#000", fontFamily: "'DM Sans',sans-serif" }}>
      {!error && <span aria-hidden="true" style={{ width: 38, height: 38, border: "3px solid rgba(255,255,255,.2)", borderTopColor: "#f97316", borderRadius: "50%", animation: "spin 1s linear infinite" }} />}
      <p style={{ margin: 0, color: error ? "#fca5a5" : "#fff", fontSize: 15, fontWeight: 600 }}>{error || "Kilax is preparing your stream"}</p>
      {accessDenied && <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 10 }}>{accessDenied === "signin" ? <Link href={`/signin?redirect=${encodeURIComponent(`/live-tv/${channelId}`)}`} style={{ borderRadius: 6, background: "#f97316", padding: "11px 16px", color: "white", fontWeight: 700, textDecoration: "none" }}>Sign in</Link> : <Link href="/?page=subscription" style={{ borderRadius: 6, background: "#f97316", padding: "11px 16px", color: "white", fontWeight: 700, textDecoration: "none" }}>Subscribe to Standard</Link>}<Link href="/?page=livetvs" style={{ border: "1px solid rgba(255,255,255,.25)", borderRadius: 6, padding: "11px 16px", color: "white", fontWeight: 700, textDecoration: "none" }}>Back</Link></div>}
    </div>}
  </main>;
}