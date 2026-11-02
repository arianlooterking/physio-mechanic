/**
 * Everything only the Android and iOS apps do. Loaded from main.tsx inside the apps only (the website never
 * downloads this code or the Capacitor plugins).
 *
 * - Live updates: the apps carry their own copy of the site (they work offline) and, on start and when they come
 *   back to the front, check <site>/app-update/latest.json (written by every site build, see
 *   scripts/app-bundle.mjs). A new version downloads in the background (checked against its SHA-256) and is
 *   switched to the next time the app is put away or opened again, or right away from Profile. A version that fails
 *   to start rolls back to the last good one by itself (Capgo updater, `notifyAppReady`), and is not tried again.
 * - The phone's back button, vibration, share sheet, saving a backup file, status bar colours and a daily reminder.
 */
import { App } from '@capacitor/app';
import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Share } from '@capacitor/share';
import { StatusBar, Style } from '@capacitor/status-bar';
import { CapacitorUpdater, type BundleInfo } from '@capgo/capacitor-updater';
import { runBack } from '../lib/back';
import { fmt } from '../lib/digits';
import { appPlatform, native, SITE } from '../lib/platform';
import { liveStreak, xpToday, type AppState } from '../lib/state';
import { getState, subscribe } from '../lib/store';
import { startSignIn } from './signin';
import { nativeStore, readVersion, REMINDER_KEY, STORES, type Reminder, type UpdateStatus } from './state';

// Updates come from the website. The emulator test points a debug build at its own test server on the test
// machine (10.0.2.2, plain http, which only debug builds allow), so the whole update path is tried before release.
const BASE = (() => {
  try {
    const o = localStorage.getItem('biomana:update-base');
    if (o && /^http:\/\/10\.0\.2\.2:\d{2,5}$/.test(o)) return o;
  } catch {
    /* ignore */
  }
  return SITE;
})();
const LATEST = `${BASE}/app-update/latest.json`;
const CHECK_EVERY_MS = 20 * 60_000;

type Latest = {
  version: string;
  builtAt: string;
  url: string;
  checksum: string;
  size: number;
  minNative: string;
  android: { versionName: string; versionCode: number; url: string } | null;
};

/** "1.10.0" > "1.9.2" */
export function newer(a: string, b: string): boolean {
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0);
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) > (pb[i] ?? 0);
  }
  return false;
}

function validLatest(x: unknown): x is Latest {
  const l = x as Latest;
  return Boolean(
    l &&
      typeof l.version === 'string' &&
      /^[0-9a-f]{16}$/.test(l.version) &&
      typeof l.url === 'string' &&
      l.url === `${BASE}/app-update/${l.version}.zip` &&
      typeof l.checksum === 'string' &&
      /^[0-9a-f]{64}$/.test(l.checksum) &&
      typeof l.minNative === 'string',
  );
}

let nativeCode = 0;
let ready: BundleInfo | null = null;
let checking = false;

async function check(manual = false) {
  const st = nativeStore.getState();
  if (checking) return;
  if (!manual && st.update.checkedAt && Date.now() - st.update.checkedAt < CHECK_EVERY_MS) return;
  checking = true;
  const status = (s: UpdateStatus) => nativeStore.setState({ update: { status: s, checkedAt: Date.now() } });
  if (manual || st.update.status === 'idle') nativeStore.setState({ update: { ...st.update, status: 'checking' } });
  try {
    // native request: no CORS, and the website's cache headers don't matter
    const res = await CapacitorHttp.get({ url: `${LATEST}?t=${Date.now()}`, headers: { Accept: 'application/json' }, readTimeout: 15_000, connectTimeout: 10_000 });
    const latest: unknown = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
    if (res.status !== 200 || !validLatest(latest)) return status('error');

    const apk = latest.android && appPlatform === 'android' && latest.android.versionCode > nativeCode ? latest.android : null;
    const needsApk = newer(latest.minNative, nativeStore.getState().appVersion);
    const store = STORES[nativeStore.getState().channel];
    nativeStore.setState({
      // a store install is only sent to its store, and only when it can't take the new lessons: the store has its own
      // update notices, and may still be reviewing the version the website already has
      apk: store
        ? needsApk && appPlatform === 'android'
          ? { versionName: latest.android?.versionName ?? '', url: store.url, required: true, store: store.name }
          : null
        : apk && apk.url.startsWith(`${SITE}/`)
          ? { versionName: apk.versionName, url: apk.url, required: needsApk }
          : null,
    });
    // this app is too old for the new web code: keep its own files (the APK banner asks for an update)
    if (needsApk) return status('latest');

    const running = nativeStore.getState().bundle?.version;
    if (running === latest.version) return status('latest');

    const { bundles } = await CapacitorUpdater.list();
    const known = bundles.find((b) => b.version === latest.version);
    // a version that already failed to start here isn't tried again; the next site build gets a new name
    if (known?.status === 'error') return status('latest');
    let bundle = known && known.status !== 'downloading' ? known : null;
    if (!bundle) {
      status('downloading');
      bundle = await CapacitorUpdater.download({ url: latest.url, version: latest.version, checksum: latest.checksum });
    }
    await CapacitorUpdater.next({ id: bundle.id });
    ready = bundle;
    status('ready');
    // older downloads are only taking space
    const current = (await CapacitorUpdater.current()).bundle.id;
    for (const b of bundles) {
      if (b.id !== 'builtin' && b.id !== current && b.id !== bundle.id && b.status !== 'error') {
        await CapacitorUpdater.delete({ id: b.id }).catch(() => {});
      }
    }
  } catch {
    status(navigator.onLine === false ? 'offline' : 'error');
  } finally {
    checking = false;
  }
}

/* ---------- daily reminder ---------- */

const REMINDER_IDS = [1001, 1002, 1003, 1004, 1005, 1006, 1007];
const LINES = [
  'ده دقیقه با فهمی؟ درس امروزت آماده است.',
  'امروز هنوز درس نخواندی؛ یک مفهوم کوتاه کافی است.',
  'کارت‌های مرور امروز منتظرند؛ چند دقیقه بیشتر طول نمی‌کشد.',
  'یک قدم کوچک امروز، یک قدم نزدیک‌تر به امتحان.',
];

async function schedule(r: Reminder) {
  const pending = await LocalNotifications.getPending().catch(() => ({ notifications: [] as { id: number }[] }));
  const ours = pending.notifications.filter((n) => REMINDER_IDS.includes(Number(n.id)));
  if (ours.length) await LocalNotifications.cancel({ notifications: ours.map((n) => ({ id: Number(n.id) })) }).catch(() => {});
  if (!r.on) return;
  const s = getState();
  const doneToday = xpToday(s) >= s.profile.goal;
  const now = new Date();
  const list = [];
  // the next seven days, one reminder a day; today only if today's goal isn't reached yet
  for (let d = 0; d < 7; d++) {
    const at = new Date(now.getFullYear(), now.getMonth(), now.getDate() + d, r.hour, r.minute);
    if (at.getTime() <= now.getTime() + 60_000 || (d === 0 && doneToday)) continue;
    const streak = liveStreak(s);
    const body = d <= 1 && streak >= 2 ? `زنجیرهٔ ${fmt(streak)} روزه‌ات منتظر است؛ یک درس کوتاه کافی است.` : LINES[(at.getDate() + d) % LINES.length];
    list.push({ id: REMINDER_IDS[d], title: 'بیومانا', body, schedule: { at, allowWhileIdle: true }, smallIcon: 'ic_stat_biomana', iconColor: '#5b3df5' });
  }
  if (list.length) await LocalNotifications.schedule({ notifications: list }).catch(() => {});
}

async function setReminder(p: Partial<Reminder>): Promise<boolean> {
  const next = { ...nativeStore.getState().reminder, ...p, asked: true };
  if (p.on) {
    const perm = await LocalNotifications.checkPermissions().catch(() => ({ display: 'denied' as const }));
    const granted = perm.display === 'granted' || (await LocalNotifications.requestPermissions().catch(() => ({ display: 'denied' }))).display === 'granted';
    if (!granted) {
      next.on = false;
      save(next);
      return false;
    }
  }
  save(next);
  await schedule(next);
  return true;
}

function save(r: Reminder) {
  nativeStore.setState({ reminder: r });
  try {
    localStorage.setItem(REMINDER_KEY, JSON.stringify(r));
  } catch {
    /* ignore */
  }
}

/* ---------- status bar ---------- */

function paintStatusBar() {
  const theme = getState().profile.theme;
  const dark = theme === 'dark' || (theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  void StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light }).catch(() => {});
  if (appPlatform === 'android') void StatusBar.setBackgroundColor({ color: dark ? '#100d24' : '#f5f3ff' }).catch(() => {});
}

const atHome = () => ['', '#', '#/'].includes(location.hash);

export async function startNative() {
  // first, before anything that can fail or wait: this version of the files started fine
  void CapacitorUpdater.notifyAppReady().catch(() => {});
  // An update downloaded last time is normally switched to when the app goes to the background; if the app was
  // closed some other way (swiped away, killed by the phone) it is still waiting, so switch now, before the
  // learner has started anything.
  try {
    const [next, cur] = await Promise.all([CapacitorUpdater.getNextBundle(), CapacitorUpdater.current()]);
    if (next && next.id !== cur.bundle.id && next.id !== 'builtin' && next.status !== 'error' && next.status !== 'downloading') {
      await CapacitorUpdater.set({ id: next.id });
      return;
    }
  } catch {
    /* ignore */
  }

  native.haptic = (ms) => {
    if (ms >= 30) void Haptics.notification({ type: NotificationType.Error }).catch(() => {});
    else void Haptics.impact({ style: ms <= 10 ? ImpactStyle.Light : ImpactStyle.Medium }).catch(() => {});
  };
  native.share = async (p) => {
    await Share.share({ title: p.title, text: p.text, url: p.url, dialogTitle: p.title });
  };
  // a file (the progress backup) goes to the share sheet, from where it can be kept in Files, Drive or a chat
  native.saveFile = async (name, text) => {
    const { uri } = await Filesystem.writeFile({ path: name, data: text, directory: Directory.Cache, encoding: Encoding.UTF8 });
    await Share.share({ title: name, files: [uri], dialogTitle: name });
  };

  nativeStore.setState({
    checkNow: () => check(true),
    applyNow: async () => {
      if (ready) await CapacitorUpdater.set({ id: ready.id });
    },
    setReminder,
    // links outside the app open in the phone's browser (Capacitor hands non-app addresses to the system)
    openUrl: (url) => {
      location.href = url;
    },
  });

  // Google sign-in through the browser needs the Browser plugin and the return address, both new in app 1.2.0
  if (Capacitor.isPluginAvailable('Browser')) void startSignIn().then(({ google, apple }) => nativeStore.setState({ googleSignIn: google, appleSignIn: apple }));

  // back: an open sheet or card first, then the previous screen; at the home screen the app is put away
  void App.addListener('backButton', ({ canGoBack }) => {
    if (runBack()) return;
    if (atHome()) void App.minimizeApp();
    else if (canGoBack) history.back();
    else location.hash = '#/';
  });

  paintStatusBar();
  let prev: AppState = getState();
  subscribe(() => {
    const s = getState();
    if (s.profile.theme !== prev.profile.theme) paintStatusBar();
    // reminders follow the day's progress: reaching today's goal drops today's reminder (every change makes a new
    // state copy, so compare what the reminders say, not the objects)
    const said = (x: AppState) => `${xpToday(x) >= x.profile.goal}|${liveStreak(x)}`;
    if (said(s) !== said(prev)) void schedule(nativeStore.getState().reminder);
    prev = s;
  });
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', paintStatusBar);

  try {
    const info = await App.getInfo();
    nativeCode = Number(info.build) || 0;
    const { version, channel } = readVersion(info.version, appPlatform);
    nativeStore.setState({ appVersion: version, channel });
  } catch {
    /* ignore */
  }
  try {
    const own = (await (await fetch('/app-build.json', { cache: 'no-store' })).json()) as { version: string; builtAt: string };
    const cur = await CapacitorUpdater.current();
    nativeStore.setState({ bundle: { version: own.version, builtAt: own.builtAt, downloaded: cur.bundle.id !== 'builtin' } });
  } catch {
    /* ignore */
  }

  const r = nativeStore.getState().reminder;
  if (r.on) void schedule(r);

  void App.addListener('appStateChange', ({ isActive }) => {
    if (!isActive) return;
    void check();
    const rem = nativeStore.getState().reminder;
    if (rem.on) void schedule(rem);
  });
  // let the first screen settle before using the network
  setTimeout(() => void check(), 3000);
}
