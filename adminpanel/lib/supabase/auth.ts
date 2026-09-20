import { createLegacySupabaseAdmin, createSupabaseAdmin } from "./admin";
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

  // Validate JWT against the canonical project first, then the legacy project for historical admins.
  const adminDb = createSupabaseAdmin();
  const legacyAdminDb = createLegacySupabaseAdmin();
  let currentUser = null as any;
  let userId = null as string | null;

  const { data, error } = await adminDb.auth.getUser(token);
  if (!error && data.user) {
    currentUser = data.user;
    userId = data.user.id;
  } else if (legacyAdminDb) {
    const legacyResult = await legacyAdminDb.auth.getUser(token);
    if (!legacyResult.error && legacyResult.data.user) {
      currentUser = legacyResult.data.user;
      userId = legacyResult.data.user.id;
    }
  }

  if (!currentUser || !userId) throw new Response("Unauthorized", { status: 401 });

  // ── Check 1: admins table in user dashboard DB ──────────────────────────
  // Schema: admins(user_id uuid PK → auth.users)
  try {
    const userDb = createUserDb();
    const { data: adminRow } = await userDb
      .from("admins")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (adminRow) return currentUser;
  } catch {
    // USER_DB credentials not set — fall through
  }

  // ── Check 2: admin_users table in admin panel DB ─────────────────────────
  const { data: panelRow } = await adminDb
    .from("admin_users")
    .select("user_id, active")
    .eq("user_id", userId)
    .maybeSingle();
  if (panelRow && panelRow.active !== false) return currentUser;

  // ── Check 3: app_metadata.role fallback ──────────────────────────────────
  const { data: fresh, error: freshErr } = await adminDb.auth.admin.getUserById(userId);
  if (freshErr || !fresh.user) {
    if (legacyAdminDb) {
      const legacyUserResult = await legacyAdminDb.auth.admin.getUserById(userId);
      if (!legacyUserResult.error && legacyUserResult.data.user?.app_metadata?.role === "admin") {
        return legacyUserResult.data.user;
      }
    }
    throw new Response("Unauthorized", { status: 401 });
  }
  if (fresh.user.app_metadata?.role === "admin") return fresh.user;

  throw new Response("Forbidden", { status: 403 });
}
