import type { Metadata } from 'next'
import './globals.css'
import ServiceWorkerRegister from '@/components/ServiceWorkerRegister'
import { AuthProvider } from '@/components/AuthProvider'
import { DeviceProvider } from '@/components/DeviceProvider'
import { ThemeProvider } from '@/components/ThemeProvider'
import FirebaseAnalytics from '@/components/FirebaseAnalytics'
import type { Viewport } from 'next'

export const viewport: Viewport = { themeColor: '#05070e', width: 'device-width', initialScale: 1, viewportFit: 'cover' }

export const metadata: Metadata = {
  title: 'Kilax Movies - Stream & Discover',
  description: 'Stream movies and series with Kilax Movies.',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'Kilax Movies', statusBarStyle: 'black-translucent' },
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // Only load OneSignal on the production domain. Localhost and blocked contexts
  // do not support a working OneSignal SW registration and should skip silently.
  const isProduction = process.env.NODE_ENV === 'production'

  return (
    <html lang="en">
      <head>
        {isProduction && (
          <>
            <script src="https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js" defer />
            <script
              dangerouslySetInnerHTML={{
                __html: `
                  window.OneSignalDeferred = window.OneSignalDeferred || [];
                  OneSignalDeferred.push(async function(OneSignal) {
                    await OneSignal.init({
                      appId: "${process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || "43192d58-cd48-4ea2-805e-6942756e8f24"}",
                      serviceWorkerPath: "/OneSignalSDKWorker.js",
                      allowLocalhostAsSecureOrigin: false,
                    });
                  });
                `,
              }}
            />
          </>
        )}
      </head>
      <body>
        <ThemeProvider>
          <AuthProvider>
            <DeviceProvider>
              {children}
            </DeviceProvider>
          </AuthProvider>
        </ThemeProvider>
        <ServiceWorkerRegister />
        <FirebaseAnalytics />

        {/*
          ── Honeypot trap ────────────────────────────────────────────────────
          This link is intentionally hidden from real users.
          Scrapers and headless crawlers that parse raw HTML will follow it,
          triggering /api/trap which logs the hit to Supabase and redirects
          the bot to Google with a "suspicious software detected" message.

          Rules that keep it invisible to real users:
            • style="display:none"  — not rendered by any browser
            • aria-hidden="true"    — excluded from assistive tech
            • tabIndex={-1}         — not reachable by keyboard
            • No text content       — nothing for screen readers to announce
          ──────────────────────────────────────────────────────────────────── */}
        <a
          href="/api/trap"
          style={{ display: "none" }}
          aria-hidden="true"
          tabIndex={-1}
          rel="nofollow noopener"
        />
      </body>
    </html>
  )
}
