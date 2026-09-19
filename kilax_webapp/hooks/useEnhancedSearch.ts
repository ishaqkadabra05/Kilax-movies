import { useState, useCallback } from 'react';

interface SearchResult {
  id: string;
  title: string;
  poster_url?: string;
  release_date?: string;
  rating?: number;
  type: 'movie' | 'series';
  genre?: string;
  description?: string;
  relevanceScore?: number;
}

interface SearchStats {
  totalCount: number;
  movieCount: number;
  seriesCount: number;
  animeCount: number;
  englishMovieCount: number;
  englishSeriesCount: number;
}

interface SearchOptions {
  filter?: 'all' | 'movies' | 'series';
  sort?: 'relevance' | 'date' | 'title';
  vj?: string;
  genre?: string;
  limit?: number;
}

export function useEnhancedSearch(defaultOptions: SearchOptions = {}) {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchStats, setSearchStats] = useState<SearchStats>({
    totalCount: 0,
    movieCount: 0,
    seriesCount: 0,
    animeCount: 0,
    englishMovieCount: 0,
    englishSeriesCount: 0,
  });

  const search = useCallback(async (query: string, options: SearchOptions = {}) => {
    if (!query.trim()) {
      setResults([]);
      setSearchStats({
        totalCount: 0,
        movieCount: 0,
        seriesCount: 0,
        animeCount: 0,
        englishMovieCount: 0,
        englishSeriesCount: 0,
      });
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const searchOptions = { ...defaultOptions, ...options };
      
      // Start with Supabase search only
      const supabaseParams = new URLSearchParams({
        q: query,
        filter: searchOptions.filter || 'all',
        sort: searchOptions.sort || 'relevance',
        vj: searchOptions.vj || 'all',
        genre: searchOptions.genre || 'all',
      });

      console.log('🔍 Starting search with query:', query);
      
      // First, get Supabase results
      const supabaseResponse = await fetch(`/api/search?${supabaseParams}`);
      const supabaseData = supabaseResponse.ok ? await supabaseResponse.json() : { results: [] };
      
      console.log('📊 Supabase results:', supabaseData.results?.length || 0);

      // Initialize results with Supabase data
      let allResults: SearchResult[] = [...(supabaseData.results || []).filter((item: any) => item && item.id)];

      // Reelplexi is the single catalog source for movie and series search.
      const reelplexiResponse = await fetch(`/api/reelplexi/search?q=${encodeURIComponent(query)}&type=all&limit=${searchOptions.limit || 50}`);
      if (reelplexiResponse.ok) {
        const reelplexiData = await reelplexiResponse.json();
        const reelplexiResults = (reelplexiData.data || [])
          .filter((item: any) => item && item.id)
          .map((item: any) => ({
            id: String(item.id),
            title: item.title || item.name || 'Unknown Title',
            poster_url: item.poster_url || item.thumbnail_url,
            release_date: item.release_date || item.first_air_date,
            rating: Number(item.score ?? item.rating ?? item.vote_average ?? 0),
            type: item.type === 'series' || item.first_air_date ? 'series' as const : 'movie' as const,
            description: item.storyline || item.synopsis || item.plot || item.overview || item.description,
          }));
        allResults = [...allResults, ...reelplexiResults];
      }

      // Calculate stats
      const stats: SearchStats = {
        totalCount: allResults.length,
        movieCount: allResults.filter(r => r.type === 'movie').length,
        seriesCount: allResults.filter(r => r.type === 'series').length,
        animeCount: 0,
        englishMovieCount: 0,
        englishSeriesCount: 0,
      };

      console.log('✅ Final search stats:', stats);

      setResults(allResults);
      setSearchStats(stats);
    } catch (err) {
      console.error('❌ Search error:', err);
      setError(err instanceof Error ? err.message : 'Search failed');
      setResults([]);
      setSearchStats({
        totalCount: 0,
        movieCount: 0,
        seriesCount: 0,
        animeCount: 0,
        englishMovieCount: 0,
        englishSeriesCount: 0,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    results,
    loading,
    error,
    searchStats,
    search,
  };
}

export function filterResultsByType(results: SearchResult[], type: string): SearchResult[] {
  if (type === 'all') return results;
  if (type === 'movies') return results.filter(r => r.type === 'movie');
  if (type === 'series') return results.filter(r => r.type === 'series');
  return results;
}