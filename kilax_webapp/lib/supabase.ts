import { createClient } from '@supabase/supabase-js'

type SupabaseClient = ReturnType<typeof createClient>

const DEFAULT_SUPABASE_URL = 'https://maijanpfppqteqzlreey.supabase.co'
const LEGACY_SUPABASE_URL = 'https://cshuwyaclvabveofknrw.supabase.co'

const defaultSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL
const defaultSupabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || 'public-anon-key-placeholder'
const defaultServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || defaultSupabaseAnonKey

const legacySupabaseUrl = process.env.NEXT_PUBLIC_LEGACY_SUPABASE_URL || process.env.LEGACY_SUPABASE_URL || LEGACY_SUPABASE_URL
const legacySupabaseAnonKey = process.env.NEXT_PUBLIC_LEGACY_SUPABASE_ANON_KEY || process.env.LEGACY_SUPABASE_ANON_KEY || 'legacy-public-anon-key-placeholder'
const legacyServiceRoleKey = process.env.LEGACY_SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_LEGACY_SUPABASE_SERVICE_ROLE_KEY || legacySupabaseAnonKey

const globalForSupabase = globalThis as typeof globalThis & {
  __kilaxSupabase?: SupabaseClient
  __kilaxSupabaseAdmin?: SupabaseClient
  __kilaxLegacySupabase?: SupabaseClient
  __kilaxLegacySupabaseAdmin?: SupabaseClient
}

export const defaultSupabase = globalForSupabase.__kilaxSupabase ?? createClient(defaultSupabaseUrl, defaultSupabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
})
globalForSupabase.__kilaxSupabase = defaultSupabase

// Canonical app database for signup, profiles, usage, subscriptions, and all new user activity.
export const supabase = defaultSupabase

// Admin client for server-side operations against the main/default app database.
export const supabaseAdmin = globalForSupabase.__kilaxSupabaseAdmin ?? createClient(
  defaultSupabaseUrl,
  defaultServiceRoleKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      storageKey: 'kilax-admin-auth-token'
    }
  }
)
globalForSupabase.__kilaxSupabaseAdmin = supabaseAdmin

// Legacy Supabase project used only for older user authentication validation.
export const legacySupabase = globalForSupabase.__kilaxLegacySupabase ?? createClient(legacySupabaseUrl, legacySupabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: false,
    detectSessionInUrl: false
  }
})
globalForSupabase.__kilaxLegacySupabase = legacySupabase

export const legacySupabaseAdmin = globalForSupabase.__kilaxLegacySupabaseAdmin ?? createClient(
  legacySupabaseUrl,
  legacyServiceRoleKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      storageKey: 'kilax-legacy-admin-auth-token'
    }
  }
)
globalForSupabase.__kilaxLegacySupabaseAdmin = legacySupabaseAdmin

// Database Types
export interface Genre {
  id: string
  name: string
  description?: string
}

export interface Movie {
  id: string
  title: string
  description?: string
  release_date?: string
  cover_image_url?: string
  trailer_url?: string
  genre_ids?: string[]
  duration?: number
  published: boolean
  premium: boolean
  created_at: string
  recommend: boolean
  popular: boolean
  latest: boolean
  vj_id?: string
  videolink_url?: string
  video_url?: string
  thumbnail_url?: string
}

export interface Series {
  id: string
  title: string
  description?: string
  release_date?: string
  cover_image_url?: string
  created_at: string
  vj_id?: string
  genre_ids?: string[]
  published: boolean
  thumbnail_url?: string
  trailer_url?: string
  seasons?: Season[]
}

export interface Season {
  id: string
  series_id: string
  name: string
  order: number
  published: boolean
  created_at: string
  episode_count?: number
  overview?: string
  episodes?: Episode[]
}

export interface Episode {
  id: string
  season_id: string
  title: string
  episode_number: number
  video_url?: string
  videolink_url?: string
  published: boolean
  premium: boolean
  duration?: number
  thumbnail_url?: string
  created_at: string
}

// Extended Episode type with season information for UI display
export interface EpisodeWithSeason extends Episode {
  seasonName: string
  seasonOrder: number
}

export interface VJ {
  id: string
  name: string
  // Add other VJ fields as needed
}

export interface Subscription {
  id: number
  user_id: string
  plan: string
  payment_method: string
  subscribed_at: string
}

export interface SubscriptionPlan {
  id: string
  name: string
  amount: number
  description: string | null
  duration: string | null
  duration_in_months: number | null
  duration_in_days: number | null
}

// Extended Movie type with VJ relation for queries that join VJ data
export interface MovieWithVJ extends Movie {
  vjs?: {
    name: string
  }
}

// Extended Series type with VJ relation for queries that join VJ data
export interface SeriesWithVJ extends Series {
  vjs?: {
    name: string
  }
}