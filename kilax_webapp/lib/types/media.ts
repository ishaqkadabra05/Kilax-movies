export type MediaType = 'movie' | 'series'

export type Page =
  | 'home'
  | 'movies'
  | 'series'
  | 'playlist'
  | 'subscription'
  | 'mylist'
  | 'profile'
  | 'history'
  | 'getapp'

export type AuthMode = 'login' | 'signup'
export type LoginMethod = 'email' | 'phone'

export interface UserProfile {
  name: string
  email: string
  phone: string
  joinDate: string
  avatar: string
  avatarBg: string
}

export interface AppNotification {
  id: string
  icon?: string | null
  title: string
  body: string
  url?: string | null
  created_at: string
  read_at?: string | null
}

export interface MediaItem {
  id: number
  sourceId?: string
  title: string
  type: MediaType
  year: number
  rating: string
  score: number
  duration: string
  genres: string[]
  description: string
  image: string
  heroImage?: string
  seasons?: number
  episodes?: number
  premium?: boolean
  isLatest?: boolean
  isTrending?: boolean
  embedUrl?: string
  vj?: string
}

export interface Episode {
  season: number
  ep: number
  title: string
  duration: string
  description: string
  thumbnail: string
  videoUrl: string
}
