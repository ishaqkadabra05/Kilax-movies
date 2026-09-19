import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/auth";
import { createUserDb } from "@/lib/supabase/user-db";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  try {
    const adminUser = await requireAdmin(request);
    const { userId } = await request.json();
    if (!userId) return NextResponse.json({ error: "User id is required" }, { status: 400 });

    // Look up the user in the user dashboard DB
    const userDb = createUserDb();
    const { data: target, error: userError } = await userDb.auth.admin.getUserById(userId);
    if (userError || !target.user?.email) {
      return NextResponse.json({ error: "User not found or has no email address" }, { status: 400 });
    }

    // Send the reset email via the user DB (matches the app's auth domain)
    const redirectTo = `${process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin}/reset-password`;
    const { error: resetError } = await userDb.auth.resetPasswordForEmail(
      target.user.email,
      { redirectTo }
    );
    if (resetError) throw resetError;

    // Audit log in the admin panel DB
    try {
      const adminDb = createSupabaseAdmin();
      await adminDb.from("admin_audit_logs").insert({
        admin_user_id: adminUser.id,
        action: "password_reset_email_sent",
        target_user_id: target.user.id,
        target_email: target.user.email,
        metadata: { source: "users_page" },
      });
    } catch {
      // Audit failure is non-fatal
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const status = error instanceof Response ? error.status : 502;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to send reset email" },
      { status }
    );
  }
}
