import { createClient } from "@supabase/supabase-js";

/**
 * Server-side client for the single Kilax Supabase project.
 * Used to read/write users, profiles, subscriptions, plans, and transactions.
 */
export function createUserDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase server credentials are not configured");
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
