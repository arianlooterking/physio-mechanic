/*
 * The Android and iOS apps (Capacitor) load these same files from the phone, at app.biomana.com.
 * There API calls need the site's full address (src/lib/api.ts), Google sign-in goes through the phone's browser
 * (src/native/signin.ts) instead of the web popup, and the service worker isn't needed (everything is on the phone).
 */
type Cap = { Capacitor?: { isNativePlatform?: () => boolean; getPlatform?: () => string } };
const cap = typeof window !== 'undefined' ? (window as unknown as Cap).Capacitor : undefined;
export const isApp = Boolean(cap?.isNativePlatform?.());
/** "android" or "ios" inside an app, "" on the site */
export const appPlatform = isApp ? (cap?.getPlatform?.() ?? 'app') : '';
export const SITE = 'https://biomana.don-aasd.workers.dev';

/**
 * What only the apps can do, filled in by src/native when the app starts (the site leaves them empty, so callers
 * fall back to the web way): a real vibration, the phone's share sheet, and saving a file through it.
 */
export const native: {
  haptic?: (ms: number) => void;
  share?: (p: { title: string; text: string; url?: string }) => Promise<void>;
  saveFile?: (name: string, text: string) => Promise<void>;
} = {};
