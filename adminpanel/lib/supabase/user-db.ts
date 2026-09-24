import { createClient } from "@supabase/supabase-js";

const DEFAULT_SUPABASE_URL = "https://maijanpfppqteqzlreey.supabase.co";
const LEGACY_SUPABASE_URL = "https://cshuwyaclvabveofknrw.supabase.co";

function getMainSupabaseUrl() {
  return process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL;
}

function getLegacySupabaseUrl() {
  return process.env.NEXT_PUBLIC_LEGACY_SUPABASE_URL || process.env.LEGACY_SUPABASE_URL || LEGACY_SUPABASE_URL;
}

function getMainSupabaseKey() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || null;
}

function getLegacySupabaseKey() {
  return process.env.LEGACY_SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_LEGACY_SUPABASE_ANON_KEY || null;
}

/**
 * Canonical project used for all new users, profiles, subscriptions, plans, and activity.
 */
export function createUserDb() {
  const url = getMainSupabaseUrl();
  const key = getMainSupabaseKey();
  if (!key) {
    throw new Error("Supabase server credentials are not configured");
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Legacy project used only to identify old users that were migrated from the previous Supabase instance.
 * This project should not be treated as the source of truth for new signups or new profile writes.
 */
export function createLegacyUserDb() {
  const url = getLegacySupabaseUrl();
  const key = getLegacySupabaseKey();
  if (!key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
