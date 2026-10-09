import type { Metadata, Viewport } from "next";
import "./globals.css";

const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || process.env.ONESIGNAL_APP_ID || "";

export const metadata: Metadata = {
  title: "Kilax Admin Panel",
  description: "Kilax administration dashboard",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Kilax Admin",
  },
};

export const viewport: Viewport = {
  themeColor: "#f97316",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        {children}
        {appId ? (
          <script
            dangerouslySetInnerHTML={{
              __html: `
                window.OneSignalDeferred = window.OneSignalDeferred || [];
                OneSignalDeferred.push(function(OneSignal) {
                  OneSignal.init({
                    appId: ${JSON.stringify(appId)},
                    allowLocalhostAsSecureOrigin: true,
                    notifyButton: {
                      enable: true,
                      size: 'medium',
                      theme: 'default',
                      position: 'bottom-left',
                      showCredit: false,
                    },
                    serviceWorker: {
                      path: '/onesignal-sw.js',
                      scope: '/' 
                    }
                  });
                });
              `,
            }}
          />
        ) : null}
        <script src="https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js" async />
      </body>
    </html>
  );
}
