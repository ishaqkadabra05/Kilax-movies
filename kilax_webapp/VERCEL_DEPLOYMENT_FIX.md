# Vercel / Production Environment

Required server variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `REELPLEXI_API_KEY`
- `REELPLEXI_BASE_URL=https://api.reelplexi.com`
- `PAYMENT_PROVIDER_API_KEY`
- `PAYMENT_PROVIDER_API_SECRET`
- `PAYMENT_PROVIDER_BASE64_AUTH` (optional if API key + secret are supplied)
- `NEXT_PUBLIC_APP_URL`

Optional security/notifications:

- `NEXT_PUBLIC_RECAPTCHA_SITE_KEY`
- `RECAPTCHA_SECRET_KEY`
- `RECAPTCHA_MIN_SCORE=0.5`
- `NEXT_PUBLIC_ONESIGNAL_APP_ID`

Legacy MakyPay and YoPayments source is retained for compatibility/history but their API routes are disabled. **All live Kilax payment flows use the payment provider.**
