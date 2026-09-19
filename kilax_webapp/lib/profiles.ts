import { supabase } from './supabase';
import { supabaseAdmin } from './supabase';

export interface Profile {
  id: string;
  full_name?: string;
  name?: string;       // alias — some queries return this
  avatar_url?: string;
  role?: string;
  created_at?: string;
  updated_at?: string;
  notifications_enabled?: boolean;
  phone?: string;
  favorite_vjs?: string[];
  favorite_genres?: string[];
  favorite_actors?: string[];
  email?: string;
  subscription?: string;
  subscription_start_date?: string;
  subscription_expiry_date?: string;
  kilax_id?: string;   // unique device/user tracking ID e.g. klm_32724489201
  coins?: number;      // referral coin balance
}

/**
 * Fetch a user's profile row.
 *
 * Supabase's `profiles` table is populated via a trigger on auth.users, but
 * the `email` column is not always synced (depends on the trigger). We
 * resolve the email with three fallbacks so it always shows:
 *
 *  1. profiles.email  (already populated)
 *  2. auth.users via service-role (supabaseAdmin.auth.admin.getUserById)
 *  3. supabase.auth.getUser()  (works when called client-side)
 */
export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) return null;
  const profile = data as Profile;

  // Email already present — nothing more to do
  if (profile.email) return profile;

  // Fallback 1: service-role admin lookup (server-side only)
  try {
    const { data: authData } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (authData?.user?.email) {
      profile.email = authData.user.email;
      return profile;
    }
  } catch {
    // not available client-side — continue
  }

  // Fallback 2: client-side session user
  try {
    const { data: sessionData } = await supabase.auth.getUser();
    if (sessionData?.user?.email) {
      profile.email = sessionData.user.email;
    }
  } catch {
    // ignore
  }

  return profile;
}

/**
 * Server-side helper: get a profile with guaranteed email using service role.
 * Use this in API routes where supabaseAdmin is available.
 */
export async function getProfileAdmin(userId: string): Promise<Profile | null> {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error || !data) return null;
  const profile = data as Profile;

  if (!profile.email) {
    const { data: authData } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (authData?.user?.email) profile.email = authData.user.email;
  }

  return profile;
}
