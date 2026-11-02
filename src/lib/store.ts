import { useSyncExternalStore } from 'react';
import { initialState, normalize, progressRank, type AppState } from './state';

/** Guest progress lives under GUEST_KEY; a signed-in Google account gets its own slot. */
export const GUEST_KEY = 'biomana:v1';
export const ACCOUNT_KEY = 'biomana:account';
export const keyForAccount = (accountId: string | null) => (accountId ? `${GUEST_KEY}:${accountId}` : GUEST_KEY);

function initialKey(): string {
  try {
    const raw = localStorage.getItem(ACCOUNT_KEY);
    const id = raw ? (JSON.parse(raw) as { id?: string }).id : null;
    return keyForAccount(typeof id === 'string' ? id : null);
  } catch {
    return GUEST_KEY;
  }
}

let KEY = typeof localStorage === 'undefined' ? GUEST_KEY : initialKey();

function load(): AppState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return normalize(JSON.parse(raw));
  } catch {
    /* storage blocked or corrupt: start fresh */
  }
  return initialState();
}

let state: AppState = typeof localStorage === 'undefined' ? initialState() : load();
const listeners = new Set<() => void>();
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let storageOk = true;

function persistNow(): void {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    storageOk = true;
  } catch {
    storageOk = false;
  }
}

function schedulePersist(): void {
  if (saveTimer) return;
  saveTimer = setTimeout(persistNow, 200);
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', persistNow);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') persistNow();
  });
  // Keep several open tabs in sync.
  window.addEventListener('storage', (e) => {
    if (e.key === KEY && e.newValue) {
      try {
        state = normalize(JSON.parse(e.newValue));
        listeners.forEach((l) => l());
      } catch {
        /* ignore */
      }
    }
  });
}

export function getState(): AppState {
  return state;
}

/** Apply a change to a copy of the state, then save and notify. */
export function update(mutator: (draft: AppState) => void): void {
  const draft = structuredClone(state);
  mutator(draft);
  state = draft;
  schedulePersist();
  listeners.forEach((l) => l());
}

export function replaceState(next: AppState): void {
  state = normalize(next);
  persistNow();
  listeners.forEach((l) => l());
}

export function resetState(): void {
  state = initialState();
  persistNow();
  listeners.forEach((l) => l());
}

/** Read the progress saved under another key without switching to it. */
export function peekState(key: string): AppState | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? normalize(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

/**
 * Point the store at another storage slot (sign in / sign out). `seed`, when given,
 * becomes that slot's progress; otherwise whatever is saved there is loaded.
 */
export function switchStorage(key: string, seed?: AppState | null): void {
  persistNow();
  KEY = key;
  state = seed ? normalize(seed) : load();
  persistNow();
  listeners.forEach((l) => l());
}

export function storageWorks(): boolean {
  return storageOk;
}

export function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useAppState(): AppState {
  return useSyncExternalStore(subscribe, getState, getState);
}

export function exportJson(): string {
  return JSON.stringify({ app: 'biomana', exportedAt: new Date().toISOString(), state }, null, 2);
}

/** Larger than any file «گرفتن پشتیبان» or «دریافت داده‌های من» makes (the server keeps at most 900 KB of progress). */
export const BACKUP_MAX_BYTES = 4 * 1024 * 1024;

export type BackupProblem = 'json' | 'not-biomana' | 'newer' | 'broken';
export type BackupRead = { ok: true; state: AppState; exportedAt: number | null } | { ok: false; problem: BackupProblem };

const isObj = (v: unknown): v is Record<string, unknown> => Boolean(v) && typeof v === 'object' && !Array.isArray(v);

/**
 * A saved progress of this version: the version field, a profile and a points total, and the main records (which
 * the oldest saves may lack) of the right kind when present.
 */
function savedStateProblem(c: unknown): BackupProblem | null {
  if (!isObj(c)) return 'broken';
  if (typeof c.v === 'number' && c.v > 1) return 'newer';
  if (c.v !== 1) return 'broken';
  const xp = c.xp as { total?: unknown } | undefined;
  const points = isObj(xp) && typeof xp.total === 'number' && Number.isFinite(xp.total) && xp.total >= 0;
  const records = (['lessons', 'concepts', 'questions', 'cards', 'mistakes', 'badges', 'streak'] as const).every((k) => c[k] === undefined || isObj(c[k]));
  return isObj(c.profile) && points && records ? null : 'broken';
}

/**
 * Read a file made by «گرفتن پشتیبان» ({app, state}) or «دریافت داده‌های من» ({app, kind: 'my-data', onThisDevice,
 * inAccount}), or a bare saved progress, without applying it. From a «داده‌های من» file the copy that has gone
 * further is taken, as at sign-in.
 */
export function readBackup(text: string): BackupRead {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, problem: 'json' };
  }
  if (!isObj(parsed)) return { ok: false, problem: 'not-biomana' };
  let copies: unknown[];
  if (parsed.app === 'biomana') {
    copies = parsed.kind === 'my-data' ? [parsed.onThisDevice, isObj(parsed.inAccount) ? parsed.inAccount.progress : undefined] : [parsed.state];
    copies = copies.filter((c) => c !== undefined && c !== null);
  } else if ('v' in parsed && 'profile' in parsed) copies = [parsed];
  else return { ok: false, problem: 'not-biomana' };
  const problems = copies.map(savedStateProblem);
  const good = copies.filter((_, k) => problems[k] === null);
  if (!good.length) return { ok: false, problem: problems.includes('newer') ? 'newer' : 'broken' };
  const best = good.reduce((a, c) => (progressRank(c) > progressRank(a) ? c : a));
  const at = typeof parsed.exportedAt === 'string' ? Date.parse(parsed.exportedAt) : NaN;
  return { ok: true, state: normalize(best), exportedAt: Number.isFinite(at) ? at : null };
}
