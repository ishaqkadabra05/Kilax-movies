/**
 * One-time bootstrap route to grant admin role to a Supabase user.
 *
 * Usage:
 *   POST /api/admin-setup
 *   Body: { "email": "you@example.com", "secret": "<ADMIN_BOOTSTRAP_SECRET>" }
 *
 * Set ADMIN_BOOTSTRAP_SECRET in .env.local to a strong random string.
 * This route is disabled (returns 404) when ADMIN_BOOTSTRAP_SECRET is not set.
 *
 * After promoting your account, remove or leave ADMIN_BOOTSTRAP_SECRET unset.
 */

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  const bootstrapSecret = process.env.ADMIN_BOOTSTRAP_SECRET;
  if (!bootstrapSecret) {
    // Route is disabled when secret is not configured
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: { email?: string; secret?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.secret || body.secret !== bootstrapSecret) {
    return NextResponse.json({ error: "Invalid bootstrap secret" }, { status: 403 });
  }

  if (!body.email) {
    return NextResponse.json({ error: "email is required" }, { status: 400 });
  }

  const admin = createSupabaseAdmin();

  // Look up the user by email
  const { data: listData, error: listError } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  if (listError) {
    return NextResponse.json({ error: listError.message }, { status: 500 });
  }

  const user = listData.users.find(
    (u) => u.email?.toLowerCase() === body.email!.toLowerCase()
  );

  if (!user) {
    return NextResponse.json(
      { error: `No user found with email: ${body.email}` },
      { status: 404 }
    );
  }

  // Grant admin role via app_metadata
  const { data: updated, error: updateError } = await admin.auth.admin.updateUserById(
    user.id,
    {
      app_metadata: {
        ...user.app_metadata,
        role: "admin",
      },
    }
  );

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    message: `User ${updated.user.email} has been granted admin role.`,
    user_id: updated.user.id,
    app_metadata: updated.user.app_metadata,
  });
}
