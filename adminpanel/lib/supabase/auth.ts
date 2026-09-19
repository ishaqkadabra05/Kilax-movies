import { createSupabaseAdmin } from "./admin";
import { createUserDb } from "./user-db";

/**
 * Validates the Bearer token from the request and confirms the user is an admin.
 *
 * Auth chain (first match wins):
 *   1. `admins` table in the user dashboard DB  (user_id row exists)
 *   2. `admin_users` table in the admin panel DB (active = true)
 *   3. app_metadata.role === "admin" in the admin panel auth
 */
export async function requireAdmin(request: Request) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    throw new Response("Unauthorized", { status: 401 });
  }
  const token = authorization.slice(7);

  // Validate JWT against the admin panel's Supabase project
  const adminDb = createSupabaseAdmin();
  const { data, error } = await adminDb.auth.getUser(token);
  if (error || !data.user) throw new Response("Unauthorized", { status: 401 });

  const userId = data.user.id;

  // ── Check 1: admins table in user dashboard DB ──────────────────────────
  // Schema: admins(user_id uuid PK → auth.users)
  try {
    const userDb = createUserDb();
    const { data: adminRow } = await userDb
      .from("admins")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (adminRow) return data.user;
  } catch {
    // USER_DB credentials not set — fall through
  }

  // ── Check 2: admin_users table in admin panel DB ─────────────────────────
  const { data: panelRow } = await adminDb
    .from("admin_users")
    .select("user_id, active")
    .eq("user_id", userId)
    .maybeSingle();
  if (panelRow && panelRow.active !== false) return data.user;

  // ── Check 3: app_metadata.role fallback ──────────────────────────────────
  const { data: fresh, error: freshErr } = await adminDb.auth.admin.getUserById(userId);
  if (freshErr || !fresh.user) throw new Response("Unauthorized", { status: 401 });
  if (fresh.user.app_metadata?.role === "admin") return fresh.user;

  throw new Response("Forbidden", { status: 403 });
}
