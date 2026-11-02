import { useSyncExternalStore } from 'react';

/**
 * What the app screens show about the app itself (Profile's «اپ بیومانا» card, the home banner). Plain state with no
 * plugin code, so the website can import the screens without loading Capacitor; src/native/index.ts fills it in
 * and puts the real actions in place.
 */
export type UpdateStatus = 'idle' | 'checking' | 'downloading' | 'ready' | 'latest' | 'offline' | 'error';

export type Reminder = { on: boolean; hour: number; minute: number; asked: boolean };

export const APP_ID = 'com.biomana.app';

/**
 * Where this install came from. The website's APK and the store builds are the same app with the same key; a store
 * build only adds its store to the versionName ("1.3.0-bazaar", android/app/build.gradle). Store installs are
 * updated by their store: Bazaar and Myket don't allow an app to send people to download it elsewhere.
 */
export type Channel = 'site' | 'bazaar' | 'myket' | 'appstore';

export const STORES: Partial<Record<Channel, { name: string; url: string }>> = {
  bazaar: { name: 'بازار', url: `https://cafebazaar.ir/app/${APP_ID}` },
  myket: { name: 'مایکت', url: `https://myket.ir/app/${APP_ID}` },
};

/** "1.3.0-bazaar" on Android → version 1.3.0 from Bazaar; any iPhone install comes from the App Store. */
export function readVersion(versionName: string, platform: string): { version: string; channel: Channel } {
  const [version, tag = ''] = versionName.split('-');
  if (platform === 'ios') return { version, channel: 'appstore' };
  return { version, channel: tag === 'bazaar' || tag === 'myket' ? tag : 'site' };
}

export const REMINDER_KEY = 'biomana:reminder';
export const DEFAULT_REMINDER: Reminder = { on: false, hour: 18, minute: 0, asked: false };

export function loadReminder(): Reminder {
  try {
    const r = JSON.parse(localStorage.getItem(REMINDER_KEY) ?? 'null') as Partial<Reminder> | null;
    if (!r) return DEFAULT_REMINDER;
    const hour = Number.isInteger(r.hour) && r.hour! >= 0 && r.hour! < 24 ? r.hour! : DEFAULT_REMINDER.hour;
    const minute = Number.isInteger(r.minute) && r.minute! >= 0 && r.minute! < 60 ? r.minute! : 0;
    return { on: r.on === true, hour, minute, asked: r.asked === true };
  } catch {
    return DEFAULT_REMINDER;
  }
}

export type NativeState = {
  /** versionName of the installed app without its store, e.g. "1.3.0" */
  appVersion: string;
  channel: Channel;
  /** the lessons and screens the app runs now: "builtin" files from the install, or a downloaded update */
  bundle: { version: string; builtAt: string; downloaded: boolean } | null;
  update: { status: UpdateStatus; checkedAt?: number };
  /**
   * A newer APK on the website (Android only), or one this app needs before it can take new updates. For a store
   * install, `store` names the store and `url` is the app's page there.
   */
  apk: { versionName: string; url: string; required: boolean; store?: string } | null;
  reminder: Reminder;
  checkNow: () => Promise<void>;
  applyNow: () => Promise<void>;
  setReminder: (r: Partial<Reminder>) => Promise<boolean>;
  openUrl: (url: string) => void;
  /** opens Google sign-in in the phone's browser (src/native/signin.ts); missing in apps older than 1.2 */
  googleSignIn?: () => Promise<void>;
  /** Sign in with Apple: Apple's sheet on iPhone, the phone's browser on Android (src/native/signin.ts) */
  appleSignIn?: () => Promise<void>;
};

let state: NativeState = {
  appVersion: '',
  channel: 'site',
  bundle: null,
  update: { status: 'idle' },
  apk: null,
  reminder: typeof localStorage === 'undefined' ? DEFAULT_REMINDER : loadReminder(),
  checkNow: async () => {},
  applyNow: async () => {},
  setReminder: async () => false,
  openUrl: (url) => void window.open(url, '_blank', 'noopener'),
};
const listeners = new Set<() => void>();

export const nativeStore = {
  getState: () => state,
  setState(p: Partial<NativeState>) {
    state = { ...state, ...p };
    listeners.forEach((l) => l());
  },
  subscribe(l: () => void) {
    listeners.add(l);
    return () => void listeners.delete(l);
  },
};

export function useNative(): NativeState {
  return useSyncExternalStore(nativeStore.subscribe, nativeStore.getState, nativeStore.getState);
}
