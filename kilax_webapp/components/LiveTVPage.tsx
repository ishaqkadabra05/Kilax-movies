"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Radio, Search, Tv2, X } from "lucide-react";
import { useResponsive } from "@/hooks/useResponsive";

type Channel = { id: string; name: string; category?: string; is_live?: boolean; logo_url?: string; icon_url?: string; image_url?: string; logo?: string; icon?: string };
function channelRows(payload: any): Channel[] { return Array.isArray(payload?.data) ? payload.data : Array.isArray(payload?.results) ? payload.results : []; }

export default function LiveTVPage() {
  const router = useRouter();
  const { mobile } = useResponsive();
  const [categories, setCategories] = useState<string[]>([]);
  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");
  const [submittedSearch, setSubmittedSearch] = useState("");
  const [channels, setChannels] = useState<Channel[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const perPage = 48;
  const totalPages = Math.max(1, Math.ceil(total / perPage));

  useEffect(() => {
    let active = true;
    fetch("/api/reelplexi/sports?endpoint=categories", { cache: "no-store" }).then(response => response.ok ? response.json() : null).then(payload => { if (active) setCategories(Array.isArray(payload?.categories) ? payload.categories : []); }).catch(() => { if (active) setCategories([]); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ endpoint: submittedSearch ? "search" : "channels", page: String(page), per_page: String(perPage) });
    if (category) params.set("category", category);
    if (submittedSearch) params.set("q", submittedSearch);
    fetch(`/api/reelplexi/sports?${params}`, { cache: "no-store" }).then(async response => { const payload = await response.json(); if (!response.ok) throw new Error(payload.error || "Live TV channels are unavailable."); return payload; }).then(payload => { if (active) { setChannels(channelRows(payload)); setTotal(Number(payload.total || 0)); } }).catch(error => { if (active) { setChannels([]); setTotal(0); setError(error instanceof Error ? error.message : "Unable to load channels."); } }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [category, page, submittedSearch]);

  return <main className="min-h-screen bg-[#05070e] px-4 pb-20 text-white sm:px-8 lg:px-12" style={{ paddingTop: `calc(${mobile ? 54 : 66}px + env(safe-area-inset-top,0px))` }}><div className="mx-auto max-w-[1500px]">
    <header className="mb-7 flex flex-wrap items-end justify-between gap-5 border-b border-white/10 pb-6"><div><p className="mb-2 text-[10px] font-extrabold uppercase tracking-[.18em] text-rose-300">Sportika · Live network</p><h1 className="font-['Anton'] text-4xl sm:text-5xl">Live TVs</h1><p className="mt-2 text-sm text-slate-400">{total.toLocaleString()} channels</p></div><div className="flex w-full flex-wrap items-center gap-3 md:w-auto"><form onSubmit={event => { event.preventDefault(); setPage(1); setSubmittedSearch(search.trim()); }} role="search" className="flex h-10 min-w-[220px] flex-1 items-center gap-2 rounded-md border border-white/10 bg-white/[.04] px-3 md:w-64 md:flex-none"><Search size={16} className="shrink-0 text-slate-500" /><input value={search} onChange={event => setSearch(event.target.value)} aria-label="Search live TV stations" placeholder="Search TV stations" className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-slate-500" />{search && <button type="button" onClick={() => { setSearch(""); setSubmittedSearch(""); setPage(1); }} aria-label="Clear station search" className="text-slate-500 hover:text-white"><X size={15} /></button>}<button type="submit" aria-label="Search stations" className="text-slate-300 hover:text-white"><Search size={15} /></button></form><label className="flex items-center gap-3 text-xs font-bold text-slate-400">CATEGORY<select value={category} onChange={event => { setCategory(event.target.value); setPage(1); }} aria-label="Filter live TV by category" className="h-10 max-w-[min(65vw,280px)] rounded-md border border-white/10 bg-[#141923] px-3 text-sm text-slate-200"><option value="">All categories</option>{categories.map(value => <option key={value} value={value}>{value}</option>)}</select></label></div></header>
    {loading ? <div className="grid min-h-48 place-items-center text-sm text-slate-500">Loading live channels…</div> : error ? <p role="alert" className="border-y border-white/10 py-12 text-center text-sm text-rose-300">{error}</p> : channels.length ? <><div className="grid gap-px overflow-hidden border-y border-white/10 bg-white/10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{channels.map(channel => { const logo = channel.logo_url || channel.icon_url || channel.image_url || channel.logo || channel.icon; return <button key={channel.id} onClick={() => router.push(`/live-tv/${encodeURIComponent(channel.id)}`)} className="flex min-h-24 items-center gap-3 bg-[#080c13] p-4 text-left transition hover:bg-[#111923]"><span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-md border border-white/10 bg-white/[.04]">{logo ? <img src={logo} alt="" loading="lazy" className="h-full w-full object-contain p-1" /> : <Tv2 size={20} className="text-emerald-200" />}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold">{channel.name}</span><span className="mt-1 block truncate text-[11px] text-slate-500">{channel.category || "Live TV"}</span></span><span className="flex shrink-0 items-center gap-1 text-[9px] font-extrabold uppercase text-rose-300"><Radio size={12} />Live</span></button>; })}</div>{totalPages > 1 && <div className="mt-6 flex items-center justify-center gap-4"><button disabled={page <= 1} onClick={() => setPage(value => Math.max(1, value - 1))} className="rounded-md border border-white/10 px-3 py-2 text-xs font-bold text-slate-300 disabled:opacity-40">Previous</button><span className="text-xs text-slate-500">Page {page} of {totalPages}</span><button disabled={page >= totalPages} onClick={() => setPage(value => Math.min(totalPages, value + 1))} className="rounded-md border border-white/10 px-3 py-2 text-xs font-bold text-slate-300 disabled:opacity-40">Next</button></div>}</> : <p className="border-y border-white/10 py-12 text-center text-sm text-slate-500">{submittedSearch ? `No TV stations found for “${submittedSearch}”.` : "No channels are available for this category."}</p>}
  </div></main>;
}
