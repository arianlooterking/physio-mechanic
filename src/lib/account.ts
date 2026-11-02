/**
 * Accounts: optional Google sign-in (Google Identity Services), or Sign in with Apple, on top of the local-first store.
 * Guests keep everything on the device. A signed-in learner gets a private progress slot that the
 * Worker also keeps (/api/progress), so the same account continues on any device.
 */
import { useSyncExternalStore } from 'react';
import { api, setAppToken } from './api';
import { isApp } from './platform';
import { nativeStore } from '../native/state';
import { carryPlan, progressRank, type AppState } from './state';
import { carryStudy } from './study';
import { ACCOUNT_KEY, getState, GUEST_KEY, keyForAccount, peekState, subscribe, switchStorage, update } from './store';

/** `owner`: the server lists this account in ADMIN_EMAILS; every lesson is open for it, with no order or daily limits. */
export type Account = { id: string; kind: 'google' | 'apple'; name: string; email?: string; picture?: string; owner?: boolean };

/**
 * Sync state for the Profile screen. 'later': the server asked us to wait (busy storage); the progress
 * is safe on this device and goes up by itself later. 'expired': the server no longer accepts this
 * device's session (it ran out, or the learner signed out on every device).
 */
export type Sync = 'idle' | 'saving' | 'saved' | 'offline' | 'later' | 'expired';

let account: Account | null = readAccount();
let sync: Sync = 'idle';
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function readAccount(): Account | null {
  try {
    const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem(ACCOUNT_KEY);
    const a = raw ? (JSON.parse(raw) as Account) : null;
    return a && typeof a.id === 'string' && (a.kind === 'google' || a.kind === 'apple') ? a : null;
  } catch {
    return null;
  }
}

function writeAccount(a: Account | null) {
  try {
    if (a) localStorage.setItem(ACCOUNT_KEY, JSON.stringify(a));
    else localStorage.removeItem(ACCOUNT_KEY);
  } catch {
    /* storage blocked: the session still works for this visit */
  }
}

export function getAccount(): Account | null {
  return account;
}

export function getSync(): Sync {
  return sync;
}

export function useAccount(): { account: Account | null; sync: Sync } {
  const a = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => account,
    () => account,
  );
  const s = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => sync,
    () => sync,
  );
  return { account: a, sync: s };
}

/** Whether the signed-in account is the site's owner (the server says so; nothing on this device can set it). */
export function useOwner(): boolean {
  return useAccount().account?.owner === true;
}

/* ───────────── Google client id + GIS script ───────────── */

const validId = (id?: string | null) => (id && id.trim().endsWith('.apps.googleusercontent.com') ? id.trim() : undefined);

type SiteConfig = { googleClientId?: string | null; apple?: boolean };
let configPromise: Promise<SiteConfig> | null = null;
function siteConfig(): Promise<SiteConfig> {
  configPromise ??= api('/api/config', { cache: 'no-store' })
    .then((r) => (r.ok ? (r.json() as Promise<SiteConfig>) : {}))
    .catch(() => {
      configPromise = null;
      return {};
    });
  return configPromise;
}

export async function googleClientId(): Promise<string | undefined> {
  // the phone apps sign in through the browser instead (startAppSignIn): Google's web button doesn't run in an app
  if (isApp) return undefined;
  const meta = validId(document.querySelector<HTMLMetaElement>('meta[name="biomana-google-client-id"]')?.content);
  return meta ?? validId((await siteConfig()).googleClientId);
}

/** Whether Sign in with Apple is switched on (the site's APPLE_SERVICES_ID, worker/apple.ts). */
export async function appleOn(): Promise<boolean> {
  return (await siteConfig()).apple === true;
}

/** The website's Sign in with Apple: Apple's page, then back to /?signin=apple with the session cookie. */
export const APPLE_START = '/api/apple-start';

type Gis = {
  accounts: {
    id: {
      initialize: (o: Record<string, unknown>) => void;
      prompt?: () => void;
      renderButton: (el: HTMLElement, o: Record<string, unknown>) => void;
      disableAutoSelect: () => void;
    };
  };
};

let gisLoading: Promise<Gis> | null = null;
function loadGis(): Promise<Gis> {
  const w = window as unknown as { google?: Gis };
  if (w.google?.accounts?.id) return Promise.resolve(w.google);
  gisLoading ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = () => (w.google ? resolve(w.google) : reject(new Error('gis missing')));
    s.onerror = () => {
      gisLoading = null;
      reject(new Error('gis failed to load'));
    };
    document.head.appendChild(s);
  });
  return gisLoading;
}

/** Draw Google's own sign-in button into `el`. Resolves false when sign-in is not configured. */
export async function renderGoogleButton(el: HTMLElement, onDone: (ok: boolean) => void, width = 300): Promise<boolean> {
  const clientId = await googleClientId();
  if (!clientId) return false;
  const g = await loadGis();
  g.accounts.id.initialize({
    client_id: clientId,
    ux_mode: 'popup',
    auto_select: false,
    callback: (r: { credential: string }) => void signInWithCredential(r.credential).then(onDone),
  });
  g.accounts.id.renderButton(el, { theme: 'outline', size: 'large', shape: 'pill', text: 'continue_with', locale: 'fa', width });
  return true;
}

/** Google's one-tap account chooser (shown by Google only when it can; silently skipped otherwise). */
export function promptOneTap(): void {
  const g = (window as unknown as { google?: Gis }).google;
  try {
    (g?.accounts.id as unknown as { prompt?: () => void })?.prompt?.();
  } catch {
    /* one-tap is optional */
  }
}

/* ───────────── sign in / out ───────────── */


type SignInAnswer = { account: Omit<Account, 'kind'>; progress: AppState | null };

async function signInWithCredential(credential: string): Promise<boolean> {
  let res: SignInAnswer;
  try {
    const r = await fetch('/api/session', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ credential }),
      credentials: 'same-origin',
    });
    if (!r.ok) return false;
    res = await r.json();
  } catch {
    return false;
  }
  applySignIn(res);
  return true;
}

function applySignIn(res: SignInAnswer): void {
  const a: Account = { ...res.account, kind: res.account.id.startsWith('apple-') ? 'apple' : 'google' };
  const key = keyForAccount(a.id);
  // Keep whichever copy has gone further: this device's slot for the account, the guest
  // progress on this device (first sign-in), or the copy saved in the account.
  const candidates = [peekState(key), account ? null : peekState(GUEST_KEY), res.progress];
  // The study plan and the grade-and-major pick are settings, not progress: the newest comes along whichever copy wins.
  const best = carryStudy(
    carryPlan(
      candidates.reduce<AppState | null>((acc, c) => (progressRank(c) > progressRank(acc) ? c : acc), null),
      candidates,
    ),
    candidates,
  );
  account = a;
  sync = 'idle';
  writeAccount(a);
  switchStorage(key, best);
  if (a.name && !getState().profile.name) {
    update((st) => {
      st.profile.name = a.name.slice(0, 30);
    });
  }
  emit();
  if (progressRank(best) !== progressRank(res.progress)) void pushNow();
}

/* ───────────── back from Sign in with Apple on the website ───────────── */

/**
 * Apple's answer goes to the Worker, which sets the session cookie and sends the learner to /?signin=apple (or
 * /?signin=failed). Take the account and its saved progress in, as a Google sign-in does, and tidy the address.
 */
let redirectFailed = false;

export function signInRedirectFailed(): boolean {
  return redirectFailed;
}

async function finishRedirectSignIn(): Promise<void> {
  try {
    const who = await fetch('/api/session', { credentials: 'same-origin', cache: 'no-store' });
    const me = who.ok ? ((await who.json()) as { account: SignInAnswer['account'] | null }).account : null;
    if (!me) throw new Error('no session');
    const p = await fetch('/api/progress', { credentials: 'same-origin', cache: 'no-store' });
    const progress = p.ok ? ((await p.json()) as { progress: AppState | null }).progress : null;
    applySignIn({ account: me, progress });
  } catch {
    redirectFailed = true;
    emit();
  }
}

if (typeof window !== 'undefined' && !isApp) {
  const back = new URLSearchParams(location.search).get('signin');
  if (back) {
    history.replaceState(history.state, '', location.pathname + location.hash);
    if (back === 'apple') void finishRedirectSignIn();
    else redirectFailed = true;
  }
}

/* ───────────── sign in inside the phone apps ───────────── */

/**
 * Google's web sign-in doesn't run inside an app, so the apps open /app/login.html in the phone's browser. It hands
 * back a one-time code that src/native/signin.ts swaps for the app's token and the account (acceptAppSignIn).
 * 'waiting': the browser is open; 'working': swapping the code; 'update': this installed app is older than 1.2 and
 * can't take the answer back, so it needs the new APK first.
 */
export type AppSignIn = 'idle' | 'waiting' | 'working' | 'failed' | 'update';
let appSignIn: AppSignIn = 'idle';
let appVia: 'google' | 'apple' = 'google';

/** Which sign-in the app started last, for the hint under the buttons. */
export function appSignInVia(): 'google' | 'apple' {
  return appVia;
}

export function getAppSignIn(): AppSignIn {
  return appSignIn;
}

export function setAppSignIn(s: AppSignIn): void {
  appSignIn = s;
  emit();
}

export function useAppSignIn(): AppSignIn {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => appSignIn,
    () => appSignIn,
  );
}

export async function startAppSignIn(via: 'google' | 'apple' = 'google'): Promise<void> {
  const open = via === 'apple' ? nativeStore.getState().appleSignIn : nativeStore.getState().googleSignIn;
  if (!open) return setAppSignIn('update');
  appVia = via;
  setAppSignIn('waiting');
  try {
    await open();
  } catch {
    setAppSignIn('failed');
  }
}

export function acceptAppSignIn(res: SignInAnswer & { token: string }): void {
  setAppToken(res.token);
  applySignIn(res);
  setAppSignIn('idle');
}

export type SignOutResult = 'ok' | 'failed' | 'session-ended';

/**
 * Sign out on this device. `everywhere` also ends the account's sessions on every other device
 * (the server retires all of its cookies); if that cannot be done, the learner stays signed in here
 * and gets 'failed'. `save: false` skips the last upload (used right after deleting the account's copy).
 */
export async function signOut(opts: { everywhere?: boolean; save?: boolean } = {}): Promise<SignOutResult> {
  if (opts.save !== false) {
    const res = await pushNow();
    // Saved a moment ago: the server wants a short gap between saves. Wait once so nothing is left behind.
    if (res.status === 'too-soon' && res.retryMs <= MIN_SERVER_GAP_MS + 1000) {
      await new Promise((r) => setTimeout(r, res.retryMs));
      await pushNow();
    }
  }
  let result: SignOutResult = 'ok';
  try {
    const r = await api(opts.everywhere ? '/api/session?all=1' : '/api/session', { method: 'DELETE' });
    // 401: this device's session had already ended, so it cannot speak for the other devices.
    if (opts.everywhere && r.status === 401) result = 'session-ended';
    else if (opts.everywhere && !r.ok) return 'failed';
  } catch {
    // Offline: this device's cookie runs out on its own, but the other devices cannot be reached.
    if (opts.everywhere) return 'failed';
  }
  if (timer) clearTimeout(timer);
  timer = null;
  if (isApp) setAppToken(null);
  (window as unknown as { google?: Gis }).google?.accounts?.id?.disableAutoSelect();
  account = null;
  writeAccount(null);
  lastSent = '';
  notBefore = 0;
  sync = 'idle';
  switchStorage(GUEST_KEY);
  emit();
  return result;
}

/* ───────────── background sync ───────────── */

/**
 * KV, where the Worker keeps the account's copy, allows only about 1,000 writes a day on the free plan
 * for the whole site. So while the learner is active their progress goes up at most once a minute,
 * trailing (the latest change is never left behind), and at once when they leave the page, the page
 * is hidden, the device comes back online, or they sign out.
 */
export const SAVE_EVERY_MS = 60_000;
/** After a quiet spell, wait this long so a burst of changes goes up as one save. */
export const FIRST_SAVE_DELAY_MS = 4_000;
/** The server's own minimum gap between two saves of one account (MIN_SAVE_GAP_MS in worker/lib.ts). */
const MIN_SERVER_GAP_MS = 15_000;

type PushResult = { status: 'ok' | 'unchanged' | 'too-soon' | 'busy' | 'expired' | 'failed'; retryMs: number };

let timer: ReturnType<typeof setTimeout> | null = null;
let lastSent = '';
let sending = '';
let lastAttempt = 0;
let notBefore = 0;

function retryAfterMs(r: Response, fallback: number): number {
  const s = Number(r.headers.get('retry-after'));
  return Number.isFinite(s) && s > 0 ? Math.min(s * 1000, 3600_000) : fallback;
}

/** Plan a save after a change. A save that is already planned carries this change too. */
function scheduleSave(): void {
  if (!account || timer) return;
  const now = Date.now();
  const at = Math.max(now + FIRST_SAVE_DELAY_MS, lastAttempt + SAVE_EVERY_MS, notBefore);
  timer = setTimeout(() => {
    timer = null;
    void pushNow();
  }, at - now);
}

/** Upload the progress now: the planned save, or the page is being left, hidden, back online, or signed out. */
async function pushNow(keepalive = false): Promise<PushResult> {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (!account || sync === 'expired') return { status: 'unchanged', retryMs: 0 };
  const body = JSON.stringify(getState());
  // Nothing new, or exactly this copy is already on its way.
  if (body === lastSent || body === sending) return { status: 'unchanged', retryMs: 0 };
  const before = sync;
  sending = body;
  sync = 'saving';
  emit();
  lastAttempt = Date.now();
  let result: PushResult;
  try {
    const r = await api('/api/progress', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body,
      keepalive: keepalive && body.length < 60_000,
    });
    if (r.ok) {
      lastSent = body;
      notBefore = 0;
      sync = 'saved';
      result = { status: 'ok', retryMs: 0 };
    } else if (r.status === 401) {
      // The session ended on the server (it ran out, or the learner signed out on every device):
      // stay signed in here and keep the progress on this device, but stop uploading.
      sync = 'expired';
      result = { status: 'expired', retryMs: 0 };
    } else if (r.status === 429) {
      // Saved a moment ago (another tab or device): quietly try again when the server says. No error shown.
      const wait = retryAfterMs(r, MIN_SERVER_GAP_MS);
      notBefore = Date.now() + wait;
      sync = before === 'saving' ? 'saved' : before;
      result = { status: 'too-soon', retryMs: wait };
    } else if (r.status === 503) {
      // Storage is busy (for example its daily write limit): the copy here is safe; try again later.
      const wait = retryAfterMs(r, 5 * 60_000);
      notBefore = Date.now() + wait;
      sync = 'later';
      result = { status: 'busy', retryMs: wait };
    } else {
      sync = 'offline';
      result = { status: 'failed', retryMs: 0 };
    }
  } catch {
    sync = 'offline';
    result = { status: 'failed', retryMs: 0 };
  }
  sending = '';
  emit();
  // Try again later, unless the session ended or the server refused the data itself.
  if (result.status === 'too-soon' || result.status === 'busy' || result.status === 'failed') scheduleSave();
  return result;
}

if (typeof window !== 'undefined') {
  subscribe(() => {
    if (account && sync !== 'expired') scheduleSave();
  });
  window.addEventListener('pagehide', () => void pushNow(true));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void pushNow(true);
  });
  window.addEventListener('online', () => void pushNow());
}

/**
 * On start-up: check the session (the server renews a week-old cookie here), then bring in progress made
 * on another device if it has gone further than this one, or send this device's copy if it is ahead.
 */
export async function pullFromServer(): Promise<void> {
  if (!account) return;
  try {
    const who = await api('/api/session', { cache: 'no-store' });
    if (who.ok) {
      const { account: me, token } = (await who.json()) as { account: { id?: string; owner?: boolean } | null; token?: string };
      // the apps' token is renewed in the answer (the website's cookie renews itself)
      if (token && isApp) setAppToken(token);
      if (!me || me.id !== account?.id) {
        sync = 'expired';
        emit();
        return;
      }
      // The owner flag follows the server (an account signed in before it existed, or taken off the list).
      if (Boolean(me.owner) !== Boolean(account.owner)) {
        account = { ...account, owner: me.owner === true || undefined };
        writeAccount(account);
        emit();
      }
    }
    const r = await api('/api/progress', { cache: 'no-store' });
    if (r.status === 401) {
      sync = 'expired';
      emit();
      return;
    }
    if (!r.ok) return;
    const { progress } = (await r.json()) as { progress: AppState | null };
    if (account && progress && progressRank(progress) > progressRank(getState()))
      switchStorage(keyForAccount(account.id), carryStudy(carryPlan(progress, [getState()]), [getState()]));
    else if (progress) {
      // This copy stays, but a plan or a grade-and-major pick made later on another device comes along.
      const plan = carryPlan(getState(), [progress]).plan;
      if (plan !== getState().plan) update((st) => void (st.plan = plan));
      const picked = carryStudy(getState(), [progress]).profile;
      if (picked !== getState().profile)
        update((st) => void Object.assign(st.profile, { grade: picked.grade, major: picked.major, focus: picked.focus, studyAt: picked.studyAt }));
    }
    const localAhead = progressRank(getState()) > progressRank(progress);
    if (!localAhead) lastSent = JSON.stringify(getState());
    sync = 'saved';
    emit();
    if (localAhead) scheduleSave();
  } catch {
    /* offline: keep going with the local copy */
  }
}

/** Delete the copy of the progress kept in the account (this device keeps its own copy). */
export async function deleteCloudCopy(): Promise<boolean> {
  if (!account) return false;
  try {
    const r = await api('/api/progress', { method: 'DELETE' });
    if (r.ok) lastSent = '';
    return r.ok;
  } catch {
    return false;
  }
}

/**
 * «دریافت داده‌های من»: everything Biomana keeps about the learner, as JSON. The progress on this
 * device and, for a Google account, the copy the server keeps (GET /api/progress).
 */
export async function myDataJson(): Promise<string> {
  let server: unknown = null;
  if (account) {
    try {
      const r = await api('/api/progress', { cache: 'no-store' });
      server = r.ok ? await r.json() : { unavailable: r.status === 401 ? 'session-ended' : `http-${r.status}` };
    } catch {
      server = { unavailable: 'offline' };
    }
  }
  return JSON.stringify(
    {
      app: 'biomana',
      kind: 'my-data',
      exportedAt: new Date().toISOString(),
      account: account ? { id: account.id, name: account.name, email: account.email ?? null, picture: account.picture ?? null } : null,
      onThisDevice: getState(),
      inAccount: account ? server : null,
    },
    null,
    2,
  );
}
