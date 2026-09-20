import { createClient } from "@supabase/supabase-js";

const DEFAULT_SUPABASE_URL = "https://maijanpfppqteqzlreey.supabase.co";
const LEGACY_SUPABASE_URL = "https://cshuwyaclvabveofknrw.supabase.co";

export function createSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRole) throw new Error("Supabase server credentials are not configured");
  return createClient(url, serviceRole, { auth: { autoRefreshToken: false, persistSession: false } });
}

export function createLegacySupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_LEGACY_SUPABASE_URL || process.env.LEGACY_SUPABASE_URL || LEGACY_SUPABASE_URL;
  const serviceRole = process.env.LEGACY_SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_LEGACY_SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRole) return null;
  return createClient(url, serviceRole, { auth: { autoRefreshToken: false, persistSession: false } });
}
