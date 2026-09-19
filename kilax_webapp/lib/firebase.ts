import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAnalytics, isSupported, logEvent, type Analytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyBcV_9DU9pe-8Rf83El2QSHvuNVivZSQ0E",
  authDomain: "kilaxmovies-app.firebaseapp.com",
  projectId: "kilaxmovies-app",
  storageBucket: "kilaxmovies-app.firebasestorage.app",
  messagingSenderId: "491415639427",
  appId: "1:491415639427:web:b8d65da9470823866c92b6",
  measurementId: "G-8ZDM376F9N",
};

export const firebaseApp: FirebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);

let analyticsPromise: Promise<Analytics | null> | null = null;

export function getFirebaseAnalytics() {
  if (typeof window === "undefined") return Promise.resolve(null);
  analyticsPromise ??= isSupported()
    .then((supported) => (supported ? getAnalytics(firebaseApp) : null))
    .catch(() => null);
  return analyticsPromise;
}

export async function trackNotificationEvent(
  name: "onesignal_prompt_shown" | "onesignal_permission_granted" | "onesignal_permission_dismissed",
) {
  const analytics = await getFirebaseAnalytics();
  if (analytics) logEvent(analytics, name);
}