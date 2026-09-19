# Kilax Admin

Next.js + React admin panel for Kilax.

## Integrations

- Reelplexi: movies, series, seasons/episodes, search and discovery.
- Payment provider: collections, transaction lookup/history and signed webhooks.
- Supabase: authentication, users, subscriptions and transaction persistence.
- OneSignal: push notification delivery.

## Setup

1. Copy `.env.example` to `.env.local` and fill in the credentials.
2. Run `supabase-schema.sql` in the Supabase SQL editor.
3. Install dependencies with `npm install` or `pnpm install`.
4. Start with `npm run dev`.

Provider credentials are intentionally used only in server-side code. Do not expose Reelplexi, payment-provider, OneSignal REST, or Supabase service-role secrets to the browser.
