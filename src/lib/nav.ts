import { useSyncExternalStore } from 'react';

/** Tabs of the free lab besides functions (#/lab). */
export const LAB_TABS = ['seq', 'prob', 'units', 'atom', 'trig', 'balance'] as const;
export type LabTab = (typeof LAB_TABS)[number];

export type Route =
  | { name: 'home' }
  | { name: 'review' }
  | { name: 'progress' }
  | { name: 'profile' }
  | { name: 'lab'; tab?: LabTab }
  | { name: 'warmup'; lessonId: string; next?: string }
  | { name: 'lesson'; lessonId: string }
  | { name: 'learn'; lessonId: string; conceptId: string }
  | { name: 'practice'; lessonId: string; nodeId: string }
  /** The lesson test, or with `set: 'konkur'` the lesson's «تست کنکوری». */
  | { name: 'test'; lessonId: string; set?: 'konkur' }
  | { name: 'cards'; scope: string }
  /** «کارت واژه»: glossary terms of the lessons started, optionally of one book. */
  | { name: 'words'; subject?: string }
  | { name: 'mistakes' }
  /** «آزمون جامع»; `lessonId` preselects that lesson's book and the lesson itself. */
  | { name: 'mock'; lessonId?: string }
  /** «چالش امروز». */
  | { name: 'daily' }
  /** «برنامهٔ مطالعه». */
  | { name: 'plan' }
  /** «برگهٔ خلاصه» of a book; `lessonId` scrolls to that lesson. */
  | { name: 'sheet'; subject: string; lessonId?: string }
  | { name: 'welcome' }
  | { name: 'login' }
  | { name: 'start' }
  | { name: 'legal'; page: 'privacy' | 'terms' }
  | { name: 'admin' };

export function parseHash(hash: string): Route {
  const parts = hash
    .replace(/^#\/?/, '')
    .split('/')
    .filter(Boolean)
    .map((p) => decodeURIComponent(p));
  switch (parts[0]) {
    case 'review':
      return { name: 'review' };
    case 'progress':
      return { name: 'progress' };
    case 'profile':
      return { name: 'profile' };
    case 'lab':
      return (LAB_TABS as readonly string[]).includes(parts[1]) ? { name: 'lab', tab: parts[1] as LabTab } : { name: 'lab' };
    case 'warmup':
      return parts[1] ? { name: 'warmup', lessonId: parts[1], next: parts[2] } : { name: 'home' };
    case 'lesson':
      return parts[1] ? { name: 'lesson', lessonId: parts[1] } : { name: 'home' };
    case 'learn':
      return parts[1] && parts[2] ? { name: 'learn', lessonId: parts[1], conceptId: parts[2] } : { name: 'home' };
    case 'practice':
      return parts[1] && parts[2] ? { name: 'practice', lessonId: parts[1], nodeId: parts[2] } : { name: 'home' };
    case 'test':
      if (!parts[1]) return { name: 'home' };
      return parts[2] === 'konkur' ? { name: 'test', lessonId: parts[1], set: 'konkur' } : { name: 'test', lessonId: parts[1] };
    case 'cards':
      return { name: 'cards', scope: parts[1] ?? 'due' };
    case 'words':
      return parts[1] ? { name: 'words', subject: parts[1] } : { name: 'words' };
    case 'mistakes':
      return { name: 'mistakes' };
    case 'mock':
      return parts[1] ? { name: 'mock', lessonId: parts[1] } : { name: 'mock' };
    case 'daily':
      return { name: 'daily' };
    case 'plan':
      return { name: 'plan' };
    case 'sheet':
      if (!parts[1]) return { name: 'home' };
      return parts[2] ? { name: 'sheet', subject: parts[1], lessonId: parts[2] } : { name: 'sheet', subject: parts[1] };
    case 'welcome':
      return { name: 'welcome' };
    case 'login':
      return { name: 'login' };
    case 'start':
      return { name: 'start' };
    case 'privacy':
    case 'terms':
      return { name: 'legal', page: parts[0] as 'privacy' | 'terms' };
    case 'admin':
      return { name: 'admin' };
    default:
      return { name: 'home' };
  }
}

export function routeHash(r: Route): string {
  const e = encodeURIComponent;
  switch (r.name) {
    case 'home':
      return '#/';
    case 'review':
      return '#/review';
    case 'progress':
      return '#/progress';
    case 'profile':
      return '#/profile';
    case 'lab':
      return r.tab ? `#/lab/${r.tab}` : '#/lab';
    case 'warmup':
      return `#/warmup/${e(r.lessonId)}${r.next ? `/${e(r.next)}` : ''}`;
    case 'lesson':
      return `#/lesson/${e(r.lessonId)}`;
    case 'learn':
      return `#/learn/${e(r.lessonId)}/${e(r.conceptId)}`;
    case 'practice':
      return `#/practice/${e(r.lessonId)}/${e(r.nodeId)}`;
    case 'test':
      return `#/test/${e(r.lessonId)}${r.set ? `/${r.set}` : ''}`;
    case 'cards':
      return `#/cards/${e(r.scope)}`;
    case 'words':
      return r.subject ? `#/words/${e(r.subject)}` : '#/words';
    case 'mistakes':
      return '#/mistakes';
    case 'mock':
      return r.lessonId ? `#/mock/${e(r.lessonId)}` : '#/mock';
    case 'daily':
      return '#/daily';
    case 'plan':
      return '#/plan';
    case 'sheet':
      return `#/sheet/${e(r.subject)}${r.lessonId ? `/${e(r.lessonId)}` : ''}`;
    case 'welcome':
      return '#/welcome';
    case 'login':
      return '#/login';
    case 'start':
      return '#/start';
    case 'legal':
      return `#/${r.page}`;
    case 'admin':
      return '#/admin/reports';
  }
}

const listeners = new Set<() => void>();
let current = typeof location !== 'undefined' ? location.hash : '';

if (typeof window !== 'undefined') {
  window.addEventListener('hashchange', () => {
    current = location.hash;
    listeners.forEach((l) => l());
    window.scrollTo({ top: 0 });
  });
}

export function go(r: Route, replace = false): void {
  const h = routeHash(r);
  if (h === location.hash) {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }
  if (replace) {
    history.replaceState(null, '', h);
    current = h;
    listeners.forEach((l) => l());
    window.scrollTo({ top: 0 });
  } else {
    location.hash = h;
  }
}

/** Open one step of a lesson path: a concept, a practice or exam step, the lesson's cards or its test. */
export function openPathNode(lessonId: string, n: { id: string; kind: string; conceptId?: string }): void {
  if (n.kind === 'concept') go({ name: 'learn', lessonId, conceptId: n.conceptId! });
  else if (n.kind === 'practice' || n.kind === 'final' || n.kind === 'hard') go({ name: 'practice', lessonId, nodeId: n.id });
  else if (n.kind === 'cards') go({ name: 'cards', scope: lessonId });
  else go({ name: 'test', lessonId });
}

/** Leave a full-screen session: go back if we came from inside the app, otherwise home. */
export function exitTo(r: Route = { name: 'home' }): void {
  go(r, true);
}

export function useRoute(): Route {
  const hash = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
    () => current,
  );
  return parseHash(hash);
}

/* ---------------- toasts ---------------- */

type ToastListener = (msg: string | null) => void;
const toastListeners = new Set<ToastListener>();
let toastTimer: ReturnType<typeof setTimeout> | null = null;

export function toast(msg: string, ms = 2600): void {
  toastListeners.forEach((l) => l(msg));
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastListeners.forEach((l) => l(null)), ms);
}

export function onToast(l: ToastListener): () => void {
  toastListeners.add(l);
  return () => toastListeners.delete(l);
}
