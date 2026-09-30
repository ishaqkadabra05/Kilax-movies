"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getSessionAuthHeaders } from "@/lib/client-auth";

type PlayerDetails = { stream_url?: string; embed_url?: string; error?: string; data?: PlayerDetails; movie?: PlayerDetails };

export default function NontranslatedMoviePlayerPage() {
  const { id } = useParams<{ id: string }>();
  const [playerUrl, setPlayerUrl] = useState("");
  const [error, setError] = useState("");
  const [preparing, setPreparing] = useState(true);
  const [accessDenied, setAccessDenied] = useState<"signin" | "standard" | null>(null);

  useEffect(() => {
    let active = true;
    setPreparing(true);
    setError("");
    setAccessDenied(null);
    getSessionAuthHeaders().then(headers => fetch(`/api/reelplexi/english-movies?id=${encodeURIComponent(id)}&playback=true`, { headers, cache: "no-store" }))
      .then(async response => {
        const payload: PlayerDetails = await response.json();
        if (!response.ok) {
          if (response.status === 401) setAccessDenied("signin");
          if (response.status === 403) setAccessDenied("standard");
          throw new Error(payload.error || "Movie playback is unavailable.");
        }
        const details = payload.movie || payload.data?.movie || payload.data || payload;
        const source = details.stream_url || details.embed_url;
        if (!source) throw new Error("No player URL is available for this movie.");
        const url = new URL(source);
        if (url.protocol !== "https:") throw new Error("This movie has an invalid player URL.");
        url.searchParams.set("autoplay", "1");
        return url.toString();
      })
      .then(url => { if (active) setPlayerUrl(url); })
      .catch(reason => { if (active) { setError(reason instanceof Error ? reason.message : "Unable to prepare the movie player."); setPreparing(false); } });
    return () => { active = false; };
  }, [id]);

  useEffect(() => {
    if (!playerUrl || !preparing) return;
    const timeout = setTimeout(() => {
      setError("The playback provider did not load this movie. Please try again later.");
      setPreparing(false);
    }, 12000);
    return () => clearTimeout(timeout);
  }, [playerUrl, preparing]);

  return <main aria-busy={preparing} style={{ position: "fixed", inset: 0, width: "100vw", height: "100dvh", overflow: "hidden", background: "#000", color: "#fff" }}>
    {playerUrl && <iframe key={playerUrl} src={playerUrl} title="English movie player" sandbox="allow-scripts allow-same-origin allow-forms allow-presentation" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen onLoad={() => setPreparing(false)} style={{ position: "absolute", inset: 0, display: "block", width: "100%", height: "100%", border: 0 }} />}
    {(preparing || error) && <div role="status" style={{ position: "absolute", inset: 0, zIndex: 1, display: "grid", placeContent: "center", justifyItems: "center", gap: 18, background: "#000", fontFamily: "'DM Sans',sans-serif" }}>
      {!error && <span aria-hidden="true" style={{ width: 38, height: 38, border: "3px solid rgba(255,255,255,.2)", borderTopColor: "#f97316", borderRadius: "50%", animation: "spin 1s linear infinite" }} />}
      <p style={{ margin: 0, color: error ? "#fca5a5" : "#fff", fontSize: 15, fontWeight: 600 }}>{error || "Kilax is loading your player"}</p>
      {accessDenied && <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 10 }}>{accessDenied === "signin" ? <Link href={`/signin?redirect=${encodeURIComponent(`/nontranslated/player/${id}`)}`} style={{ borderRadius: 6, background: "#f97316", padding: "11px 16px", color: "white", fontWeight: 700, textDecoration: "none" }}>Sign in</Link> : <Link href="/?page=subscription" style={{ borderRadius: 6, background: "#f97316", padding: "11px 16px", color: "white", fontWeight: 700, textDecoration: "none" }}>View eligible plans</Link>}<Link href="/?page=english" style={{ border: "1px solid rgba(255,255,255,.25)", borderRadius: 6, padding: "11px 16px", color: "white", fontWeight: 700, textDecoration: "none" }}>Back</Link></div>}
    </div>}
  </main>;
}