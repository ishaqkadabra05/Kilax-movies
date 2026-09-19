# Kilax Movies Integration Setup

This build uses the shared Supabase project/schema and subscription packages from the Downloads integration, Reelplexi for the movie/series catalogue and playback, and **the payment provider for every payment method**.

## Payments — the payment provider only

- Mobile Money: the payment provider collection (`method=mobile_money`) for Uganda MTN/Airtel.
- Visa/Mastercard: the payment provider card collection (`method=card`) using the provider redirect URL.
- Webhooks and transaction status are handled through the payment provider.
- Subscription activation is performed only after a successful the payment provider transaction.
- Legacy MakyPay source code is retained only as requested, but its API routes are disabled and no payment flow calls it.
- Legacy YoPayments routes are disabled.

Set server-only variables:

```env
PAYMENT_PROVIDER_API_KEY=
PAYMENT_PROVIDER_API_SECRET=
PAYMENT_PROVIDER_BASE64_AUTH=
```

Never expose these credentials in client-side code.

## Reelplexi

```env
REELPLEXI_API_KEY=
REELPLEXI_BASE_URL=https://api.reelplexi.com
```

The client never receives the Reelplexi secret API key. Search, trending, catalogue, streams, episodes and downloads are resolved server-side.

## Authentication and security

```env
NEXT_PUBLIC_RECAPTCHA_SITE_KEY=
RECAPTCHA_SECRET_KEY=
RECAPTCHA_MIN_SCORE=0.5
NEXT_PUBLIC_ONESIGNAL_APP_ID=
ONESIGNAL_REST_API_KEY=
```

Notifications

- Apply `supabase/migrations/20260909_notifications.sql` to create the in-app notification tables.
- Set `ONESIGNAL_REST_API_KEY` as a server-only environment variable from the OneSignal dashboard. Never expose it as `NEXT_PUBLIC_*`.
- Administrators whose `profiles.role` is `admin` can publish from `/admin/notifications`.
- Leave recipient IDs blank to notify all profiles, or provide comma-separated Supabase user IDs for a targeted notification.
- Each notification is stored in Supabase and delivered to subscribed OneSignal devices. Users must allow browser notifications before push delivery can reach them.

Google OAuth is supported through Supabase. New accounts are required to submit a phone number before continuing.

## Downloads

Downloads are server-authorized against the user's current subscription. **Standard packages only** can download. Free and Basic users are redirected to the subscription page when they attempt a download.

## UI

- Mobile catalogue grids use three cards per row.
- Home starts with the shorter hero followed by Reelplexi-marked Trending Now.
- Top Picks For You is hidden until the user watches or searches/interacts with a title and is then based on watched genres.
- Home includes additional horizontal rows with See More controls.
- Search queries the Reelplexi database.
- Movie/series detail dialogs show storyline, genres and rating.
- The original `/public/logo.png` is preserved and the platform name is displayed as **Kilax Movies**.
- Footer wording intentionally does not expose backend/provider names.
