"use client";

import React from "react";
import Image from "next/image";
import { Play, Download, Star } from "lucide-react";
import { useAuth } from "./AuthProvider";

interface HeroDetailProps {
  title: string;
  subtitle?: string;
  description: string;
  score?: number;
  year: string | number;
  vj?: string;
  genres: string[];
  coverImage: string;
  onWatch: () => void;
  onDownload: () => void;
  primaryColor?: string;
  requiresPremium?: boolean;
}

export default function HeroDetail({ title, subtitle, description, score = 0, year, vj, genres, coverImage, onWatch, onDownload, primaryColor = "#f97316" }: HeroDetailProps) {
  const { user } = useAuth();
  const displayYear = String(year || "").slice(0,4) || String(year || "");
  const story = description || "Storyline unavailable.";
  const displayGenres = genres.filter(g => g.toLowerCase() !== "musical").slice(0,4);
  const image = coverImage;

  return (
    <section className="relative w-full min-h-[430px] flex flex-col lg:flex-row items-stretch bg-gray-900">
      <div className="absolute inset-0 z-0">
        <Image src={image} alt={title} fill className="object-cover object-center opacity-60" priority />
        <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/65 to-transparent" />
      </div>

      <div className="relative z-10 flex-1 flex flex-col justify-end lg:justify-center px-5 py-10 sm:px-8 lg:py-16 lg:pl-16 lg:pr-8 text-white">
        <div className="max-w-3xl">
          {subtitle && <h2 className="text-orange-400 text-xs font-semibold uppercase mb-2 tracking-wide">{subtitle}</h2>}
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4 leading-tight" style={{ color: primaryColor }}>{title}</h1>
          <div className="flex items-center gap-3 text-xs sm:text-sm mb-4 flex-wrap">
            {score > 0 && <span className="inline-flex items-center gap-1 text-amber-300 font-bold"><Star size={14} fill="currentColor" />{score.toFixed(1)} Reelplexi</span>}
            {displayYear && <span className="rounded bg-gray-800/80 px-2.5 py-1 font-semibold">{displayYear}</span>}
            {vj && <span className="rounded bg-gray-800/80 px-2.5 py-1 font-semibold">VJ: {vj}</span>}
            {displayGenres.map(g => <span key={g} className="rounded bg-gray-800/80 px-2.5 py-1 font-semibold">{g}</span>)}
          </div>
          <p className="text-sm sm:text-base lg:text-lg text-gray-200 mb-6 max-w-2xl leading-relaxed line-clamp-4">{story}</p>
          <div className="flex gap-3 flex-wrap">
            <button onClick={onWatch} className={`font-bold py-3 px-7 rounded-lg shadow transition-all min-w-[140px] flex items-center justify-center gap-2 ${!user ? "bg-gray-600 text-gray-300" : "bg-orange-500 hover:bg-orange-600 text-white"}`} title={!user ? "Sign in to watch" : "Watch Now"}>
              <Play size={18} fill="currentColor" />{!user ? "Sign in to watch" : "Watch Now"}
            </button>
            <button onClick={onDownload} className="bg-gray-800/90 hover:bg-gray-700 text-white font-semibold py-3 px-6 rounded-lg min-w-[110px] flex items-center justify-center gap-2"><Download size={18}/>Download</button>
          </div>
        </div>
      </div>

      <div className="hidden lg:flex items-center justify-center w-[360px] xl:w-[420px] flex-shrink-0 relative z-10 pr-10">
        <div className="relative aspect-[2/3] w-64 xl:w-72 rounded-xl overflow-hidden shadow-xl border border-orange-400/60">
          <Image src={coverImage} alt={title} fill className="object-cover object-center" priority />
        </div>
      </div>
      <div className="pointer-events-none absolute left-0 right-0 bottom-0 h-28 z-20" style={{background:"linear-gradient(180deg, transparent 0%, #09090b 90%)"}} />
    </section>
  );
}
