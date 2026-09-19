# Admin panel updates

## Content Usage
Added **Contents → Content Usage**. It calls `/api/reelplex-usage` server-side and displays:
- Total Search Requests
- Total Downloads
- Total Full Streams
- Total API Usage
- Top Most Viewed Content

Set `REELPLEXI_USAGE_PATH` to the usage/analytics endpoint exposed by your Reelplexi account/API key. The public Reelplexi API documentation currently documents content, search, download, and streaming endpoints, while the authenticated Usage dashboard is a separate analytics page; therefore the usage endpoint is configurable instead of being hard-coded to an undocumented route.

## Plans
The Plans page and subscription editor now fetch active plans from Supabase through `/api/plans`. No hard-coded plan catalog is used for display or subscription editing.

## Password resets + audit logs
Users now have **Send Password Reset**. The action:
1. Requires an authenticated admin.
2. Sends the Supabase password reset email.
3. Inserts `password_reset_email_sent` into `public.admin_audit_logs`.
4. Shows a flash message: `Reset link sent to user`.

Run `supabase-admin-audit.sql` once in Supabase SQL Editor before using the reset action.
