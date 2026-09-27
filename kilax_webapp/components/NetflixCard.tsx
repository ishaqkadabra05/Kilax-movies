import Link from "next/link";
import Image from "next/image";
import { Star } from "lucide-react";
import { Movie, Series } from "@/lib/supabase";
import { recordUsageActivity } from "@/lib/usage";

// Netflix-style card component for both movies and series
type CatalogMovie = {
  id: number | string;
  title?: string;
  poster_url?: string;
  cover_url?: string;
  description?: string;
  release_date?: string;
  thumbnail_url?: string;
  cover_image_url?: string;
  score?: number;
  rating?: number;
  vote_average?: number;
};

type NetflixCardProps = {
  content: Movie | Series | CatalogMovie;
  type: "movie" | "series";
  isNonTranslated?: boolean;
};

export const NetflixCard = ({ content, type, isNonTranslated = false }: NetflixCardProps) => {
  const recordCardView = () => {
    void recordUsageActivity({
      eventType: "card_view",
      contentType: type,
      contentId: String(content.id),
      contentTitle: content.title || null,
    });
  };

  const getHref = () => {
    if (isNonTranslated) {
      return `/non-translated/${type === "movie" ? "movies" : "series"}/${content.id}`;
    }
    return `/${type === "movie" ? "movies" : "series"}/${content.id}`;
  };

  // Get the best available image URL with type safety
  const getImageUrl = (): string => {
    return content.thumbnail_url ||
      content.cover_image_url ||
      (('poster_url' in content && content.poster_url) ? content.poster_url as string : '') ||
      (('poster_path' in content && content.poster_path) ? content.poster_path as string : '') ||
      (('backdrop_path' in content && content.backdrop_path) ? content.backdrop_path as string : '') ||
      `https://via.placeholder.com/240x360/1f2937/f97316?text=${encodeURIComponent(content.title || '')}`;
  };

  // Get rating from Reelplexi fields and nested rating objects.
  const getRating = (): number => {
    const candidates = [
      (content as any).score,
      (content as any).rating,
      (content as any).vote_average,
      (content as any).imdb_rating,
      (content as any).imdb_score,
      (content as any).average_rating,
      (content as any).ratings?.imdb,
      (content as any).ratings?.tmdb,
      (content as any).ratings?.average,
      (content as any).ratings?.score,
      (content as any).ratings?.value,
    ];

    for (const candidate of candidates) {
      if (candidate === null || candidate === undefined || candidate === '') continue;

      if (typeof candidate === 'number' && Number.isFinite(candidate)) {
        if (candidate > 0 && candidate <= 10) return Number(candidate.toFixed(1));
        if (candidate > 10 && candidate <= 100) return Number((candidate / 10).toFixed(1));
        continue;
      }

      if (typeof candidate === 'string') {
        const trimmed = candidate.trim();
        if (!trimmed || trimmed.toLowerCase() === 'n/a' || trimmed.toLowerCase() === 'nr') continue;

        const normalized = trimmed.replace(/\s+/g, '');
        if (!/^\d+(?:\.\d+)?(?:\/10|\/100|%)?$/.test(normalized)) continue;

        const numeric = Number(normalized.replace(/%$/, '').replace(/\/10$/, '').replace(/\/100$/, ''));
        if (!Number.isFinite(numeric) || numeric <= 0) continue;

        if (numeric <= 10) return Number(numeric.toFixed(1));
        if (numeric <= 100) return Number((numeric / 10).toFixed(1));
      }

      if (Array.isArray(candidate)) {
        for (const item of candidate) {
          const parsed = Array.isArray(item) ? item[0] : item;
          if (typeof parsed === 'number' && Number.isFinite(parsed)) {
            if (parsed > 0 && parsed <= 10) return Number(parsed.toFixed(1));
            if (parsed > 10 && parsed <= 100) return Number((parsed / 10).toFixed(1));
          }
        }
      }
    }

    return 0;
  };

  const rating = getRating();

  return (
    <div className="group">
      <Link href={getHref()} className="tv-focusable" aria-label={`Open ${content.title || type}`} onClick={recordCardView}>
      <div className="cursor-pointer transition-transform duration-200 hover:scale-105 tv-card-target">
        <div className="aspect-[2/3] relative rounded-lg overflow-hidden bg-gray-800 mb-2">
          <Image
            src={getImageUrl()}
            alt={content.title || `Poster for ${type}`}
            fill
            className="object-cover transition-opacity duration-300"
            unoptimized
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.src = `https://via.placeholder.com/240x360/1f2937/f97316?text=${encodeURIComponent(content.title || '')}`;
            }}
          />
        )

          {/* Content type badge - smaller */}
          <div className={`absolute top-1 left-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${
            type === "movie" ? "bg-[#FF7F50]" : "bg-[#1ABC9C]"
          }`}>
            {type === "movie" ? "Movie" : "Series"}
          </div>

          {/* Rating badge - bottom left */}
          {rating > 0 && (
            <div className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-black/80 backdrop-blur-sm flex items-center gap-0.5">
              <Star size={10} className="fill-yellow-400 text-yellow-400" />
              <span className="text-[10px] font-bold text-white">{rating.toFixed(1)}</span>
            </div>
          )}

          {/* Description overlay on hover - simplified */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col justify-end p-2">
            <p className="text-[10px] text-gray-300 line-clamp-2 leading-tight">
              {(typeof (content as any).overview === 'string' && (content as any).overview
  ? (content as any).overview.slice(0, 40)
  : content.description?.slice(0, 40)) + '...' || 'Tap to view details'}
            </p>
          </div>
        </div>
      </div>
    </Link>

    {/* Content info outside the card - more compact */}
    <div className="mt-1">
      <h3 className="font-medium text-white text-xs truncate leading-tight" style={{ fontFamily: "Aptos, 'Segoe UI', sans-serif" }}>{content.title}</h3>
      <div className="flex items-center gap-1 text-[10px] text-gray-400 mt-0.5">
        {content.release_date && (
          <span>{new Date(content.release_date).getFullYear()}</span>
        )}
      </div>
    </div>
  </div>
  );
};
