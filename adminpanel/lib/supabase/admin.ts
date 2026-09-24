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

export function createSupabaseAdmin() {
  const url = getMainSupabaseUrl();
  const serviceRole = getMainSupabaseKey();
  if (!serviceRole) throw new Error("Supabase server credentials are not configured");
  return createClient(url, serviceRole, { auth: { autoRefreshToken: false, persistSession: false } });
}

export function createLegacySupabaseAdmin() {
  const url = getLegacySupabaseUrl();
  const serviceRole = getLegacySupabaseKey();
  if (!serviceRole) return null;
  return createClient(url, serviceRole, { auth: { autoRefreshToken: false, persistSession: false } });
}
