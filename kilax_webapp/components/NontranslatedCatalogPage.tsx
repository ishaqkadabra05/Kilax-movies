"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Film, Search, Tv2, X } from "lucide-react";
import { useResponsive } from "@/hooks/useResponsive";

type EnglishMovie = {
  id: number;
  title: string;
  poster_url?: string;
  backdrop_url?: string;
  release_date?: string;
  vote_average?: number;
};

type EnglishSeries = {
  id: string | number;
  title?: string;
  name?: string;
  poster_url?: string;
  thumbnail_url?: string;
  cover_image_url?: string;
  first_air_date?: string;
  original_language?: string;
  language?: string;
  vj?: string;
  vj_name?: string;
  translator?: string;
  vjs?: { name?: string };
};

type DownloadLink = { quality: string; size?: string; url: string };
const feeds = ["popular", "trending", "top-rated", "now-playing", "upcoming"] as const;

function rows<T>(payload: any): T[] {
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.data?.series)) return payload.data.series;
  return Array.isArray(payload?.results) ? payload.results : [];
}

function PosterTile({ title, image, subtitle }: { title: string; image?: string; subtitle?: string }) {
  return <div className="relative aspect-[2/3] overflow-hidden rounded-md border border-white/10 bg-[#171b24]">
    {image ? <img src={image} alt={title} loading="lazy" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-slate-600"><Film size={32} /></div>}
    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/75 to-transparent p-3 pt-12">
      <p className="line-clamp-2 text-sm font-bold text-white">{title}</p>
      {subtitle && <p className="mt-1 text-[11px] text-slate-300">{subtitle}</p>}
    </div>
  </div>;
}

export default function NontranslatedCatalogPage() {
  const { mobile } = useResponsive();
  const [feed, setFeed] = useState<(typeof feeds)[number]>("popular");
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [movies, setMovies] = useState<EnglishMovie[]>([]);
  const [moviePage, setMoviePage] = useState(1);
  const [movieTotalPages, setMovieTotalPages] = useState(1);
  const [movieLoading, setMovieLoading] = useState(false);
  const [movieError, setMovieError] = useState("");
  const [series, setSeries] = useState<EnglishSeries[]>([]);
  const [seriesPage, setSeriesPage] = useState(1);
  const [seriesHasMore, setSeriesHasMore] = useState(false);
  const [seriesLoading, setSeriesLoading] = useState(false);
  const [seriesError, setSeriesError] = useState("");
  const [downloadMovie, setDownloadMovie] = useState<EnglishMovie | null>(null);
  const [downloadLinks, setDownloadLinks] = useState<DownloadLink[]>([]);
  const [downloadsLoading, setDownloadsLoading] = useState(false);

  useEffect(() => {
    let active = true;
    setMovieLoading(true);
    setMovieError("");
    const params = new URLSearchParams({ endpoint: submittedQuery ? "search" : feed, page: String(moviePage), per_page: "24" });
    if (submittedQuery) params.set("q", submittedQuery);
    fetch(`/api/reelplexi/english-movies?${params}`, { cache: "no-store" })
      .then(async response => {
        const payload = await response.json();
        if (!response.ok) throw new Error("Kilax could not load English movies.");
        return payload;
      })
      .then(payload => {
        if (!active) return;
        setMovies(rows<EnglishMovie>(payload));
        setMovieTotalPages(Math.max(1, Number(payload.total_pages || payload.pagination?.total_pages || 1)));
      })
      .catch(() => { if (active) { setMovies([]); setMovieError("Kilax could not load English movies. Please try again."); } })
      .finally(() => { if (active) setMovieLoading(false); });
    return () => { active = false; };
  }, [feed, moviePage, submittedQuery]);

  useEffect(() => {
    let active = true;
    setSeriesLoading(true);
    setSeriesError("");
    fetch(`/api/reelplexi/nontranslated/series?page=${seriesPage}&limit=100`, { cache: "no-store" })
      .then(async response => {
        const payload = await response.json();
        if (!response.ok) throw new Error("Kilax could not load English series.");
        return payload;
      })
      .then(payload => {
        if (!active) return;
        const englishRows = rows<EnglishSeries>(payload).filter(item => {
          const language = String(item.original_language || item.language || "").trim().toLowerCase();
          return (language === "en" || language === "english") && !item.vj && !item.vj_name && !item.translator && !item.vjs?.name;
        });
        setSeries(englishRows);
        setSeriesHasMore(Boolean(payload.pagination?.hasMore));
      })
      .catch(() => { if (active) { setSeries([]); setSeriesError("Kilax could not load English series. Please try again."); } })
      .finally(() => { if (active) setSeriesLoading(false); });
    return () => { active = false; };
  }, [seriesPage]);

  const showDownloads = async (movie: EnglishMovie) => {
    setDownloadMovie(movie);
    setDownloadsLoading(true);
    setDownloadLinks([]);
    try {
      const response = await fetch(`/api/reelplexi/english-movies?id=${encodeURIComponent(movie.id)}&downloads=true`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error("Download options are unavailable.");
      const links = payload.links || payload.download_links?.links || payload.data?.links || [];
      setDownloadLinks(Array.isArray(links) ? links : []);
    } catch {
      setDownloadLinks([]);
    } finally {
      setDownloadsLoading(false);
    }
  };

  const px = mobile ? 16 : 48;

  return <main className="min-h-screen bg-[#05070e] px-4 pb-20 text-white sm:px-8 lg:px-12" style={{ paddingTop: `calc(${mobile ? 54 : 66}px + env(safe-area-inset-top,0px))` }}>
    <div className="mx-auto max-w-[1500px]">
      <header className="mb-8 border-b border-white/10 pb-6">
        <p className="mb-2 text-[10px] font-extrabold uppercase tracking-[.18em] text-emerald-300">Kilax · Nontranslated</p>
        <h1 className="font-['Anton'] text-4xl sm:text-5xl">Nontranslated</h1>
      </header>

      <section aria-labelledby="english-movies-heading" className="pb-10">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <h2 id="english-movies-heading" className="text-2xl font-bold text-white">English Movies</h2>
          <form onSubmit={event => { event.preventDefault(); setMoviePage(1); setSubmittedQuery(query.trim()); }} className="flex h-10 w-full max-w-md items-center gap-2 rounded-md border border-white/10 bg-white/[.04] px-3">
            <Search size={15} className="shrink-0 text-slate-500" />
            <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search English movies" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-600" />
            {query && <button type="button" aria-label="Clear search" onClick={() => { setQuery(""); setSubmittedQuery(""); }} className="text-slate-500 hover:text-white"><X size={15} /></button>}
          </form>
        </div>
        <div className="mb-5 flex flex-wrap gap-2">
          {feeds.map(value => <button key={value} onClick={() => { setFeed(value); setMoviePage(1); setSubmittedQuery(""); }} className={`rounded-md border px-3 py-2 text-xs font-semibold capitalize ${feed === value && !submittedQuery ? "border-emerald-300 bg-emerald-300 text-black" : "border-white/10 text-slate-400 hover:text-white"}`}>{value.replaceAll("-", " ")}</button>)}
        </div>
        {movieLoading ? <div className="grid min-h-48 place-items-center text-sm text-slate-500">Loading English movies…</div> : movieError ? <p role="alert" className="py-10 text-center text-sm text-rose-300">{movieError}</p> : movies.length ? <>
          <div className="nontranslated-poster-grid grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7">
            {movies.map(movie => <article key={movie.id} className="group min-w-0">
              <Link href={`/nontranslated/movies/${movie.id}`} aria-label={`View details for ${movie.title}`} className="block"><PosterTile title={movie.title} image={movie.poster_url || movie.backdrop_url} subtitle={`${String(movie.release_date || "").slice(0, 4)}${movie.vote_average ? ` · ${Number(movie.vote_average).toFixed(1)}` : ""}`} /></Link>
              <button onClick={() => showDownloads(movie)} className="mt-2 w-full rounded-md border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-xs font-bold text-emerald-200 transition hover:bg-emerald-400/20">Download options</button>
            </article>)}
          </div>
          {movieTotalPages > 1 && <div className="mt-7 flex items-center justify-center gap-4"><button disabled={moviePage <= 1} onClick={() => setMoviePage(value => Math.max(1, value - 1))} className="rounded-md border border-white/10 px-3 py-2 text-xs font-bold text-slate-300 disabled:opacity-40">Previous</button><span className="text-xs text-slate-500">Page {moviePage} of {movieTotalPages}</span><button disabled={moviePage >= movieTotalPages} onClick={() => setMoviePage(value => Math.min(movieTotalPages, value + 1))} className="rounded-md border border-white/10 px-3 py-2 text-xs font-bold text-slate-300 disabled:opacity-40">Next</button></div>}
        </> : <p className="py-10 text-center text-sm text-slate-500">No English movies found.</p>}
      </section>

      <section aria-labelledby="english-series-heading" className="border-t border-white/10 pt-8">
        <div className="mb-5 flex items-end justify-between gap-4"><div><h2 id="english-series-heading" className="text-2xl font-bold text-white">English Series</h2><p className="mt-1 text-sm text-slate-400">English-language series without VJ translation</p></div></div>
        {seriesLoading ? <div className="grid min-h-40 place-items-center text-sm text-slate-500">Loading English series…</div> : seriesError ? <p role="alert" className="py-10 text-center text-sm text-rose-300">{seriesError}</p> : series.length ? <>
          <div className="nontranslated-poster-grid grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7">
            {series.map(item => <PosterTile key={item.id} title={item.title || item.name || "Untitled"} image={item.poster_url || item.thumbnail_url || item.cover_image_url} subtitle={String(item.first_air_date || "").slice(0, 4)} />)}
          </div>
          <div className="mt-7 flex items-center justify-center gap-4"><button disabled={seriesPage <= 1} onClick={() => setSeriesPage(value => Math.max(1, value - 1))} className="rounded-md border border-white/10 px-3 py-2 text-xs font-bold text-slate-300 disabled:opacity-40">Previous</button><span className="text-xs text-slate-500">Page {seriesPage}</span><button disabled={!seriesHasMore} onClick={() => setSeriesPage(value => value + 1)} className="rounded-md border border-white/10 px-3 py-2 text-xs font-bold text-slate-300 disabled:opacity-40">Next</button></div>
        </> : <p className="border-y border-white/10 py-10 text-center text-sm text-slate-500">English series are not available in the current catalog.</p>}
      </section>
    </div>

    {downloadMovie && <div className="fixed inset-0 z-[100] grid place-items-center bg-black/80 p-4" onClick={() => setDownloadMovie(null)}><section role="dialog" aria-modal="true" aria-label={`${downloadMovie.title} download options`} onClick={event => event.stopPropagation()} className="w-full max-w-lg border border-white/15 bg-[#111722] p-5 shadow-2xl"><div className="mb-4 flex items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-widest text-emerald-300">English movie downloads</p><h2 className="mt-1 text-lg font-bold">{downloadMovie.title}</h2></div><button onClick={() => setDownloadMovie(null)} aria-label="Close download options" className="rounded-md p-2 text-slate-400 hover:bg-white/10 hover:text-white"><X size={17} /></button></div>{downloadsLoading ? <p className="py-8 text-center text-sm text-slate-400">Loading available qualities…</p> : downloadLinks.length ? <div className="divide-y divide-white/10">{downloadLinks.map((link, index) => <a key={`${link.quality}-${index}`} href={link.url} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-3 py-3 text-sm hover:text-emerald-200"><span className="font-bold">{link.quality}</span><span className="text-xs text-slate-500">{link.size || "Direct download"}</span><span className="text-xs font-bold text-emerald-300">Download</span></a>)}</div> : <p className="py-6 text-center text-sm text-slate-400">No download links are available for this title.</p>}</section></div>}
  </main>;
}