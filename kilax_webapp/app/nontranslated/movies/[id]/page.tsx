"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Download, Heart, Play, Star, X } from "lucide-react";

type EnglishMovie = {
  id: number;
  title: string;
  overview?: string;
  poster_url?: string;
  backdrop_url?: string;
  release_date?: string;
  vote_average?: number;
  runtime?: number;
  original_language?: string;
  genre_ids?: number[];
  stream_url?: string;
  embed_url?: string;
  download_links?: { links?: DownloadLink[] };
};
type DownloadLink = { quality: string; size?: string; url: string; type?: string };

const genreNames: Record<number, string> = {
  12: "Adventure", 14: "Fantasy", 16: "Animation", 18: "Drama", 27: "Horror", 28: "Action",
  35: "Comedy", 36: "History", 37: "Western", 53: "Thriller", 80: "Crime", 99: "Documentary",
  9648: "Mystery", 10402: "Music", 10749: "Romance", 10751: "Family", 10752: "War", 10770: "TV Movie",
  878: "Science Fiction",
};

export default function NontranslatedMovieDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [movie, setMovie] = useState<EnglishMovie | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [accessDenied, setAccessDenied] = useState<"signin" | "standard" | null>(null);
  const [favorite, setFavorite] = useState(false);
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [downloads, setDownloads] = useState<DownloadLink[]>([]);
  const [downloadsLoading, setDownloadsLoading] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setAccessDenied(null);
    fetch(`/api/reelplexi/english-movies?id=${encodeURIComponent(id)}&include_downloads=true`, { cache: "no-store" })
      .then(async response => {
        const payload = await response.json();
        if (!response.ok) {
          if (response.status === 401) setAccessDenied("signin");
          if (response.status === 403) setAccessDenied("standard");
          throw new Error(payload.error || "Movie details are unavailable.");
        }
        return payload;
      })
      .then(payload => { if (active) setMovie(payload.data?.movie || payload.data || payload); })
      .catch(reason => { if (active) setError(reason instanceof Error ? reason.message : "Unable to load movie details."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id]);

  useEffect(() => {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem("kilax-nontranslated-favorites") || "[]");
      setFavorite(Array.isArray(saved) && saved.includes(Number(id)));
    } catch {
      setFavorite(false);
    }
  }, [id]);

  const toggleFavorite = () => {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem("kilax-nontranslated-favorites") || "[]");
      const favorites = new Set(Array.isArray(saved) ? saved.map(Number) : []);
      if (favorites.has(Number(id))) favorites.delete(Number(id));
      else favorites.add(Number(id));
      localStorage.setItem("kilax-nontranslated-favorites", JSON.stringify([...favorites]));
      setFavorite(favorites.has(Number(id)));
    } catch {
      setError("Favorites could not be saved on this device.");
    }
  };

  const openDownloads = async () => {
    setDownloadOpen(true);
    setDownloadsLoading(true);
    setDownloads([]);
    try {
      const response = await fetch(`/api/reelplexi/english-movies?id=${encodeURIComponent(id)}&downloads=true`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Download options are unavailable.");
      const links = payload.links || payload.download_links?.links || payload.data?.links || [];
      setDownloads(Array.isArray(links) ? links : []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Download options are unavailable.");
    } finally {
      setDownloadsLoading(false);
    }
  };

  if (loading) return <main className="grid min-h-screen place-items-center bg-[#05070e] text-white"><p>Loading movie details…</p></main>;
  if (error && !movie) return <main className="grid min-h-screen place-items-center bg-[#05070e] p-6 text-center text-rose-200"><div><p>{accessDenied === "standard" ? "An active Standard package is required to view this movie." : accessDenied === "signin" ? "Sign in to view this movie." : error}</p><div className="mt-5 flex flex-wrap justify-center gap-3">{accessDenied === "signin" && <Link href={`/signin?redirect=${encodeURIComponent(`/nontranslated/movies/${id}`)}`} className="rounded-md bg-orange-500 px-4 py-3 text-sm font-bold text-white">Sign in</Link>}{accessDenied === "standard" && <Link href="/?page=subscription" className="rounded-md bg-orange-500 px-4 py-3 text-sm font-bold text-white">Subscribe to Standard</Link>}<Link href="/?page=english" className="inline-flex items-center gap-2 rounded-md border border-white/20 px-4 py-3 text-sm font-semibold text-white"><ArrowLeft size={16} />Back</Link></div></div></main>;
  if (!movie) return null;

  const title = movie.title || "Untitled";
  const year = movie.release_date ? new Date(movie.release_date).getFullYear() : "";
  const genres = (movie.genre_ids || []).map(genreId => genreNames[genreId]).filter(Boolean);
  const rating = Number(movie.vote_average || 0);
  const heroImage = movie.backdrop_url || movie.poster_url;

  return <main className="min-h-screen bg-[#05070e] text-white">
    <section className="relative min-h-[680px] overflow-hidden bg-[#080b12] lg:min-h-[740px]">
      {heroImage && <img src={heroImage} alt="" className="absolute inset-0 h-full w-full object-cover object-center opacity-45" />}
      <div className="absolute inset-0 bg-linear-to-r from-[#05070e] via-[#05070e]/80 to-[#05070e]/35" />
      <div className="absolute inset-0 bg-linear-to-t from-[#05070e] via-transparent to-black/35" />
      <div className="relative mx-auto flex min-h-[680px] max-w-[1440px] items-end px-5 pb-12 pt-6 sm:px-10 lg:min-h-[740px] lg:items-center lg:px-16 lg:pb-16">
        <div className="max-w-3xl">
          <Link href="/?page=english" className="mb-12 inline-flex items-center gap-2 text-sm font-semibold text-slate-300 transition hover:text-white"><ArrowLeft size={17} />Nontranslated movies</Link>
          <p className="mb-3 text-xs font-extrabold uppercase tracking-[.18em] text-emerald-300">English movie</p>
          <h1 className="text-4xl font-extrabold leading-tight sm:text-5xl lg:text-6xl">{title}</h1>
          <div className="mt-5 flex flex-wrap items-center gap-3 text-sm text-slate-300">
            {year && <span>{year}</span>}
            {movie.runtime ? <span>{movie.runtime} min</span> : null}
            {rating > 0 && <span className="inline-flex items-center gap-1 text-amber-300"><Star size={15} fill="currentColor" />{rating.toFixed(1)}</span>}
          </div>
          <div className="mt-5 flex flex-wrap gap-2">{genres.length > 0 ? genres.map(genre => <span key={genre} className="rounded-full border border-white/15 bg-black/35 px-3 py-1.5 text-xs font-semibold text-slate-200">{genre}</span>) : <span className="text-xs text-slate-400">Genre information unavailable</span>}</div>
          <p className="mt-6 max-w-2xl text-sm leading-7 text-slate-200 sm:text-base">{movie.overview || "Storyline unavailable."}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <button onClick={() => router.push(`/nontranslated/player/${encodeURIComponent(id)}`)} className="inline-flex min-h-12 items-center gap-2 rounded-md bg-emerald-400 px-6 py-3 font-bold text-black transition hover:bg-emerald-300"><Play size={17} fill="currentColor" />Play movie</button>
            <button onClick={openDownloads} className="inline-flex min-h-12 items-center gap-2 rounded-md border border-white/20 bg-white/10 px-5 py-3 font-semibold text-white transition hover:bg-white/15"><Download size={17} />Download options</button>
            <button onClick={toggleFavorite} aria-pressed={favorite} className={`inline-flex min-h-12 items-center gap-2 rounded-md border px-5 py-3 font-semibold transition ${favorite ? "border-rose-400/50 bg-rose-400/15 text-rose-200" : "border-white/20 bg-black/25 text-white hover:bg-white/10"}`}><Heart size={17} fill={favorite ? "currentColor" : "none"} />{favorite ? "In favorites" : "Add to favorites"}</button>
          </div>
        </div>
        {movie.poster_url && <img src={movie.poster_url} alt={`${title} poster`} className="ml-auto hidden max-h-[540px] w-auto max-w-[34%] rounded-md object-cover shadow-2xl lg:block" />}
      </div>
    </section>
    {error && <p role="status" className="mx-auto max-w-5xl px-5 py-3 text-sm text-rose-300">{error}</p>}
    {downloadOpen && <div className="fixed inset-0 z-[100] grid place-items-center bg-black/80 p-4" onClick={() => setDownloadOpen(false)}><section role="dialog" aria-modal="true" aria-label={`${title} download options`} onClick={event => event.stopPropagation()} className="w-full max-w-lg border border-white/15 bg-[#111722] p-5 shadow-2xl"><div className="mb-4 flex items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-widest text-emerald-300">Download options</p><h2 className="mt-1 text-lg font-bold">{title}</h2></div><button onClick={() => setDownloadOpen(false)} aria-label="Close download options" className="rounded-md p-2 text-slate-400 hover:bg-white/10 hover:text-white"><X size={18} /></button></div>{downloadsLoading ? <p className="py-8 text-center text-sm text-slate-400">Loading available qualities…</p> : downloads.length ? <div className="divide-y divide-white/10">{downloads.map((download, index) => <a key={`${download.quality}-${index}`} href={download.url} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-3 py-3 text-sm hover:text-emerald-200"><span className="font-bold">{download.quality}</span><span className="text-xs text-slate-500">{download.size || "Direct download"}</span><span className="text-xs font-bold text-emerald-300">Download</span></a>)}</div> : <p className="py-6 text-center text-sm text-slate-400">No download links are available for this title.</p>}</section></div>}
  </main>;
}